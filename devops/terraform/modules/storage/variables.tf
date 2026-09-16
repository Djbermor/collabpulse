variable "environment" { type = string }
variable "location" { type = string }
variable "resource_group_name" { type = string }
variable "unique_suffix" { type = string }
variable "replication_type" { type = string; default = "ZRS" } # Zone Redundant Storage
variable "tags" { type = map(string) }

output "storage_account_id" { value = azurerm_storage_account.storage.id }
output "storage_account_name" { value = azurerm_storage_account.storage.name }
output "primary_blob_endpoint" { value = azurerm_storage_account.storage.primary_blob_endpoint }
output "primary_connection_string" { value = azurerm_storage_account.storage.primary_connection_string; sensitive = true }
output "container_name" { value = azurerm_storage_container.workspaces_container.name }
