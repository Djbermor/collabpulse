variable "environment" { type = string }
variable "location" { type = string }
variable "resource_group_name" { type = string }
variable "sku" { type = string; default = "Premium" }
variable "tags" { type = map(string) }
