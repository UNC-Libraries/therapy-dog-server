# Copyright 2017 The University of North Carolina at Chapel Hill
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#    http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.
require 'rubygems'
require 'bundler/setup'

require "fileutils"
require "nokogiri"
require "json"
require "open-uri"

PREFIXES = { "xmi" => "http://www.omg.org/XMI", "xsi" => "http://www.w3.org/2001/XMLSchema-instance" }

class Identifiers
  attr_reader :id

  def initialize
    @next_id = 1
    @ids = {}
  end

  def get(thing)
    @ids[thing]
  end

  def touch(id, thing)
    if id != nil
      @ids[thing] = id
      id
    else
      id = "_#{@next_id}"
      @next_id += 1
      @ids[thing] = id
      id
    end
  end
end

def href_name(node, type)
  if type == :mods && node["href"] =~ /^http:\/\/www.loc.gov\/mods\/v3#\/\/([^\/]+)\/(.+)$/
    $2
  elsif type == :acl && node["href"] =~ /^http:\/\/dcr.unc.edu\/definitions\/acl#\/\/([^\/]+)\/(.+)$/
    $2
  else
    nil
  end
end

def convert_attributes(element, identifiers, type, path)
  element.xpath("attributes").map do |attribute|
    default_value = attribute["defaultValue"]
    mapped_feature = attribute.at_xpath("mappedFeature")
    name = href_name(mapped_feature, type)
    output = attribute["Output"]
    
    if output != nil && output.start_with?("/")
      # These are always of the form "/0/@model/@elements.0/@ports.0"
      
      if output =~ /\/0\/@model\/@elements.(\d+)\/@ports.(\d+)/
        element = element.document.at_xpath("//model/elements[#{$1.to_i+1}]/ports[#{$2.to_i+1}]")
        output = identifiers.get(element)
      else
        raise "Unexpected output path: #{output}"
      end
    end
    
    if output != nil
      value = { type: "lookup", path: path + [output] }
    else
      value = { type: "string", value: default_value }
    end
    
    if name == "value" || name == "mixed"
      value
    else
      if type == :acl
        name = "acl:" + name
      end
      
      if name == "acl:embargoUntil"
        name = "acl:embargo-until"
      end
    
      {
        type: "structure",
        name: "@" + name,
        properties: { value: value }
      }
    end
  end
end

def convert_child_elements(mapped_element, identifiers, type, path)
  mapped_element.xpath("childElements").map do |child_element|
    mapped_feature = child_element.at_xpath("mappedFeature")
    name = href_name(mapped_feature, type)
    
    if type == :acl
      name = "acl:" + name
    end
    
    {
      type: "structure",
      name: name,
      children: convert_child_elements(child_element, identifiers, type, path) + convert_attributes(child_element, identifiers, type, path)
    }
  end
end

def convert_mapped_elements(metadata_block, identifiers, type, path)
  metadata_block.xpath("elements").map do |mapped_element|
    mapped_feature = mapped_element.at_xpath("mappedFeature")
    name = href_name(mapped_feature, type)
    properties = {}
  
    if name.nil? || name == "value"
      next
    end
  
    if type == :acl && name == "accessControl"
      name = "acl:accessControl"
    
      properties["xmlns:acl"] = { type: "string", value: "http://dcr.unc.edu/definitions/acl" }
    end
  
    {
      type: "structure",
      name: name,
      properties: properties,
      children: convert_child_elements(mapped_element, identifiers, type, path) + convert_attributes(mapped_element, identifiers, type, path)
    }
  end.compact
end

def convert_mapping(doc, identifiers, type)
  main_body = doc.xpath("//elements[@xmi:type='walk:MetadataBlock' or @xsi:type='walk:MetadataBlock']", PREFIXES).inject([]) do |list, metadata_block|
    id = identifiers.get(metadata_block)
    
    begin
      max_repeat = Integer(metadata_block["maxRepeat"])
    rescue
      max_repeat = 1
    end
    
    if max_repeat > 1

      elements = convert_mapped_elements(metadata_block, identifiers, type, ["item"])
    
      if elements.any?
        list << {
          type: "each",
          items: { type: "lookup", path: [id] },
          locals: { item: "item" },
          body: elements
        }
      end
      
    else
      
      list += convert_mapped_elements(metadata_block, identifiers, type, [id])
      
    end
    
    list
  end
  
  if type == :mods
    {
      type: "structure",
      name: "mods",
      properties: { xmlns: { type: "string", value: "http://www.loc.gov/mods/v3" } },
      children: main_body
    }
  else
    if main_body.size > 1
      raise "More than one item in main body of :acl mapping"
    end
    
    if main_body.size == 0
      nil
    else
      main_body[0]
    end
  end
end

def convert_form(xml, form_id)
  identifiers = Identifiers.new

  doc = Nokogiri::XML(xml)

  output = {}

  form = doc.at_xpath("//model[@xmi:type='walk:Form' or @xsi:type='walk:Form']", PREFIXES)

  if form.nil?
    raise "Couldn't find form"
  end

  output[:title] = form["title"]
  output[:description] = form["description"]
  output[:destination] = form["depositContainerId"]
  
  
  # Contact
  
  contact_name = form["contactName"] || ""
  contact_email = form["contactEmail"] || ""
  
  if contact_name !~ /^\s*$/ && contact_email !~ /^\s*$/
    output[:contact] = {
      name: contact_name,
      email: contact_email
    }
  end
  
  
  # Form fields

  output[:children] = []

  form.xpath("elements[@xmi:type='walk:MetadataBlock' or @xsi:type='walk:MetadataBlock' or @xsi:type='walk:MajorBlock']", PREFIXES).each do |block|
    if block["xsi:type"] == "walk:MajorBlock"
      
      field = {
        type: "select",
        key: identifiers.touch(block["xmi:id"], block),
        label: block["label"],
        options: "honors-majors"
      }

      output[:children] << field
      
    else
      
      begin
        max_repeat = Integer(block["maxRepeat"])
      rescue
        max_repeat = 1
      end

      section = {
        type: "section",
        key: identifiers.touch(block["xmi:id"], block),
        label: block["name"],
        repeat: max_repeat > 1,
        children: []
      }

      output[:children] << section

      block.xpath("ports").each do |port|
        field = {
          key: identifiers.touch(port["xmi:id"], port),
          label: port["label"]
        }

        validations = {}

        if port["required"] == "true"
          field[:required] = true
        end

        if port["usage"] != nil && port["usage"] != ""
          field[:placeholder] = port["usage"]
        end

        if port.xpath("validValues").any?
          field[:options] = port.xpath("validValues").map { |v| v.text }
        elsif port["vocabularyURL"] != nil && port["vocabularyURL"] != ""
          url = port["vocabularyURL"]

          if url =~ /^https:\/\/cdr.lib.unc.edu\/shared\/vocab\/.*\.txt$/
            field[:options] = File.basename(url, ".txt")
          else
            raise "Vocabulary URL outside of shared/vocab: #{url}"
          end
        end

        if port["allowFreeText"] == "false"
          field[:type] = "select"
        elsif port.xpath("validValues").any?
          field[:type] = "select"
          field[:options] = port.xpath("validValues").map { |v| v.text }
        elsif port["xmi:type"] == "walk:EmailInputField" || port["xsi:type"] == "walk:EmailInputField"
          field[:type] = "email"
        elsif port["xmi:type"] == "walk:TextInputField" || port["xsi:type"] == "walk:TextInputField"
          field[:type] = "text"
          
          if port["type"] == "MultipleLines"
            field[:size] = "paragraph"
          end
        elsif port["xmi:type"] == "walk:DateInputField" || port["xsi:type"] == "walk:DateInputField"
          field[:type] = "date"

          if port["datePrecision"] != nil && port["datePrecision"] != ""
            field[:precision] = port["datePrecision"]
          end
        end

        section[:children] << field
        
      end
    end
  end
  
  
  # Templates
  
  mods_template = convert_mapping(doc, identifiers, :mods)
  acl_template = convert_mapping(doc, identifiers, :acl)
  
  if form_id == "honors-thesis"
    majors_identifier = identifiers.get(form.at_xpath("elements[@xsi:type='walk:MajorBlock']", PREFIXES))
    
    # children of <name> for Author Information
    mods_template[:children][0][:children] << {
      type: "structure",
      name: "affiliation",
      properties: {},
      children: [
        { type: "lookup", path: [majors_identifier, "name"] }
      ]
    }
    
    acl_template = {
      type: "structure",
      name: "acl:accessControl",
      properties: {
        "xmlns:acl" => { type: "string", value: "http://dcr.unc.edu/definitions/acl" }
      },
      children: [
        {
          type: "each",
          items: { type: "lookup", path: [majors_identifier, "observerGroups"] },
          locals: { item: "group" },
          body: [
            {
              type: "structure",
              name: "grant",
              properties: {
                group: { type: "lookup", path: ["group"] },
                role: { type: "string", value: "observer" }
              }
            }
          ]
        }
      ]
    }
  end
  
  output[:metadata] = []
  
  if mods_template
    output[:metadata] << {
      id: "main-mods",
      type: "descriptive",
      model: "xml",
      template: mods_template
    }
  end
  
  if acl_template
    output[:metadata] << {
      id: "main-acl",
      type: "access-control",
      model: "xml",
      template: acl_template
    }
  end
  
  if form_id == "art-mfa"
    output[:metadata] << {
      id: "art-mfa-work-sample-mods",
      type: "descriptive",
      model: "xml",
      template: {
        type: "structure",
        name: "mods",
        properties: {
          xmlns: { type: "string", value: "http://www.loc.gov/mods/v3" }
        },
        children: [
          {
            type: "arrow",
            items: { type: "lookup", path: ["title"] },
            target: [
              { type: "structure", name: "titleInfo" },
              { type: "structure", name: "title" }
            ]
          },
          {
            type: "structure",
            name: "physicalDescription",
            children: [
              {
                type: "arrow",
                items: { type: "lookup", path: ["medium"] },
                target: [
                  { type: "structure", name: "form", properties: { type: { type: "string", value: "material" } } },
                ]
              },
              {
                type: "arrow",
                items: { type: "lookup", path: ["dimensions"] },
                target: [
                  { type: "structure", name: "extent" },
                ]
              }
            ]
          },
          {
            type: "arrow",
            items: { type: "lookup", path: ["date"] },
            target: [
              { type: "structure", name: "originInfo" },
              { type: "structure", name: "dateCreated", properties: { encoding: { type: "string", value: "iso8601" } } }
            ]
          },
          {
            type: "arrow",
            items: { type: "lookup", path: ["narrative"] },
            target: [
              { type: "structure", name: "abstract" }
            ]
          }
        ]
      }
    }
  end
  
  if form_id == "honors-thesis"
    majors_identifier = identifiers.get(form.at_xpath("elements[@xsi:type='walk:MajorBlock']", PREFIXES))
    
    output[:metadata] << {
      id: "honors-thesis-cover-acl",
      type: "access-control",
      model: "xml",
      template: {
        type: "structure",
        name: "acl:accessControl",
        properties: {
          "xmlns:acl" => { type: "string", value: "http://dcr.unc.edu/definitions/acl" },
          "acl:inherit" => { type: "string", value: "false" }
        },
        children: [
          {
            type: "each",
            items: { type: "lookup", path: [majors_identifier, "observerGroups"] },
            locals: { item: "group" },
            body: [
              {
                type: "structure",
                name: "acl:grant",
                properties: {
                  "acl:group" => { type: "lookup", path: ["group"] },
                  "acl:role" => { type: "string", value: "observer" }
                }
              }
            ]
          },
          {
            type: "structure",
            name: "acl:grant",
            properties: {
              "acl:group" => { type: "string", value: "unc:app:lib:cdr:honorsthesiscurator" },
              "acl:role" => { type: "string", value: "curator" }
            }
          },
          {
            type: "structure",
            name: "acl:grant",
            properties: {
              "acl:group" => { type: "string", value: "unc:app:lib:cdr:honorsthesisreviewer" },
              "acl:role" => { type: "string", value: "observer" }
            }
          }
        ]
      }
    }
  end
  
  
  # Deposit Notices
  
  output[:notificationRecipientEmails] = []
  
  form.xpath("emailDepositNoticeTo", PREFIXES).each do |email|
    output[:notificationRecipientEmails] << {
      type: "string",
      value: email.text.strip
    }
  end
  
  if form_id == "honors-thesis"
    majors_identifier = identifiers.get(form.at_xpath("elements[@xsi:type='walk:MajorBlock']", PREFIXES))
    output[:notificationRecipientEmails] << {
      type: "lookup",
      path: [majors_identifier, "emailDepositNoticeTo"]
    }
    
    # Special case for EmailInputField -- there's only one and it's on this form.
    advisor_block_identifier = identifiers.get(form.at_xpath("//ports[@xsi:type='walk:EmailInputField']/..", PREFIXES))
    advisor_email_identifier = identifiers.get(form.at_xpath("//ports[@xsi:type='walk:EmailInputField']", PREFIXES))
    output[:notificationRecipientEmails] << {
      type: "lookup",
      path: [advisor_block_identifier, advisor_email_identifier]
    }
  end
  
  
  # Files
  
  main_file = nil
  other_files = []
  supplemental_files = nil
  
  if form.xpath("elements[@xmi:type='walk:FileBlock' or @xsi:type='walk:FileBlock']", PREFIXES).empty?
    field = {
      type: "file",
      key: "main",
      label: "File for Deposit",
      required: true
    }
    
    main_file = "main"

    output[:children] << field
  end

  form.xpath("elements[@xmi:type='walk:FileBlock' or @xsi:type='walk:FileBlock']", PREFIXES).each do |block|
    key = identifiers.touch(block["xmi:id"], block)
    
    field = {
      type: "file",
      key: key,
      label: block["name"]
    }
    
    if block["defaultAccess"] == "true"
      main_file = key
    else
      other_files << key
    end

    if block["required"] == "true"
      field[:required] = true
    end

    output[:children] << field
  end

  if form["canAddSupplementalFiles"]
    field = {
      type: "file",
      key: "supplemental",
      label: "Supplemental Files",
      multiple: true
    }
    
    supplemental_files = "supplemental"

    output[:children] << field
  end
  
  if form_id == "art-mfa"
    output[:children] << {
      type: "section",
      key: "work-samples",
      label: "Work Samples",
      repeat: true,
      children: [
        {
          type: "file",
          key: "file",
          label: "Work Sample",
          required: true
        },
        {
          type: "text",
          key: "title",
          label: "Title",
          required: true
        },
        {
          type: "text",
          key: "medium",
          label: "Medium/Materials",
          required: true
        },
        {
          type: "text",
          key: "dimensions",
          label: "Dimensions",
          required: true
        },
        {
          type: "date",
          key: "date",
          label: "Year",
          precision: "year",
          required: true
        },
        {
          type: "text",
          key: "narrative",
          label: "Brief narrative",
          size: "paragraph",
          required: true
        }
      ]
    }
  end
  
  
  # Bundles
  
  aggregate_metadata = []
  
  if mods_template
    aggregate_metadata << "main-mods"
  end
  
  if acl_template
    aggregate_metadata << "main-acl"
  end
  
  output[:bundle] = {
    type: "aggregate",
    aggregate: {
      metadata: aggregate_metadata
    },
    main: {
      upload: main_file
    },
    supplemental: []
  }
  
  if supplemental_files
    output[:bundle][:supplemental] << {
      upload: supplemental_files
    }
  end
  
  if form_id == "art-mfa"
    output[:bundle][:supplemental] << {
      context: "work-samples",
      upload: "file",
      metadata: ["art-mfa-work-sample-mods"]
    }
  end
  
  if form_id == "honors-thesis"
    cover_identifier = identifiers.get(form.at_xpath("elements[@name='Cover page']", PREFIXES))
    
    output[:bundle][:supplemental] << {
      upload: cover_identifier,
      metadata: ["honors-thesis-cover-acl"]
    }
  end
  
  output
end

def extract_majors_vocabulary(xml, vocabs_output_path)
  doc = Nokogiri::XML(xml)

  block = doc.at_xpath("//elements[@xsi:type='walk:MajorBlock']", PREFIXES)
  
  if block
    terms = block.xpath("majorEntries").map do |entries|
      {
        name: entries["name"],
        observerGroups: entries.xpath("observerGroups").map { |g| g.text },
        emailDepositNoticeTo: entries.xpath("emailDepositNoticeTo").map { |g| g.text }
      }
    end
  
    vocab = {
      terms: terms,
      valueKey: "name",
      labelKey: "name"
    }
  
    File.open(File.join(vocabs_output_path, "honors-majors.json"), "w+") do |f|
      f << JSON.pretty_generate(vocab)
    end
  end
end

def download_vocabularies(xml, vocabs_output_path)
  doc = Nokogiri::XML(xml)

  doc.xpath("//ports").each do |port|
    if port["vocabularyURL"] != nil && port["vocabularyURL"] =~ /^https:\/\/dcr.lib.unc.edu\/shared\/vocab\/.*\.txt$/
      id = File.basename(port["vocabularyURL"], ".txt")

      vocab = {
        terms: []
      }

      open(port["vocabularyURL"]) do |f|
        f.each_line do |line|
          vocab[:terms] << line.strip
        end
      end

      File.open(File.join(vocabs_output_path, id + ".json"), "w+") do |f|
        f << JSON.pretty_generate(vocab)
      end
    end
  end

end

require "docopt"
doc = <<DOCOPT
Usage:
  #{__FILE__} --forms-output=<forms-output-path> --vocab-output=<vocab-output-path> <form-xml>...
  #{__FILE__} -h | --help

Options:
  -h --help     Show this screen.

DOCOPT

begin
  options = Docopt::docopt(doc)
rescue Docopt::Exit => e
  puts e.message
  exit
end

forms_output_path = options["--forms-output"]
vocabs_output_path = options["--vocab-output"]
form_paths = options["<form-xml>"]

FileUtils.mkdir_p(forms_output_path)
FileUtils.mkdir_p(vocabs_output_path)

form_paths.each do |path|
  begin
    xml = File.read(path)
    id = File.basename(path, ".form")

    download_vocabularies(xml, vocabs_output_path)
    extract_majors_vocabulary(xml, vocabs_output_path)

    output = convert_form(xml, id)
    json = JSON.pretty_generate(output)

    File.open(File.join(forms_output_path, id + ".json"), "w+") do |f|
      f << json
    end
  rescue StandardError => exception
    puts "#{path}: #{exception.inspect}"
    raise exception
  end
end
