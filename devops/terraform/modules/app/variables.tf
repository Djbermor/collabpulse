variable "environment" { type = string }
variable "location" { type = string }
variable "resource_group_name" { type = string }
variable "app_subnet_id" { type = string }
variable "log_analytics_id" { type = string }
variable "acr_login_server" { type = string }
variable "app_insights_connection_string" { type = string; sensitive = true }
variable "api_min_replicas" { type = number; default = 2 }
variable "api_max_replicas" { type = number; default = 10 }
variable "tags" { type = map(string) }
