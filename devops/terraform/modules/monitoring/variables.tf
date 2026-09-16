variable "environment" { type = string }
variable "location" { type = string }
variable "resource_group_name" { type = string }
variable "retention_in_days" { type = number; default = 90 }
variable "alert_email" { type = string; default = "devops-alerts@collabpulse.com" }
variable "tags" { type = map(string) }
