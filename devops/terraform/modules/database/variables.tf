variable "environment" { type = string }
variable "location" { type = string }
variable "resource_group_name" { type = string }
variable "vnet_id" { type = string }
variable "db_subnet_id" { type = string }
variable "admin_username" { type = string; default = "collabpulse_admin" }
variable "admin_password" { type = string; sensitive = true }
variable "sku_name" { type = string; default = "GP_Standard_D4ds_v5" }
variable "storage_mb" { type = number; default = 65536 }
variable "backup_retention_days" { type = number; default = 35 }
variable "geo_redundant_backup" { type = bool; default = true }
variable "enable_ha" { type = bool; default = true }
variable "standby_zone" { type = string; default = "2" }
variable "tags" { type = map(string) }

output "server_fqdn" { value = azurerm_postgresql_flexible_server.postgres.fqdn }
output "database_name" { value = azurerm_postgresql_flexible_server_database.app_db.name }
output "server_id" { value = azurerm_postgresql_flexible_server.postgres.id }
