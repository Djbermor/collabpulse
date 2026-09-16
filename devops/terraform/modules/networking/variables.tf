variable "environment" { type = string }
variable "location" { type = string }
variable "location_short" { type = string }
variable "resource_group_name" { type = string }
variable "vnet_cidr" { type = string }
variable "tags" { type = map(string) }

output "vnet_id" { value = azurerm_virtual_network.vnet.id }
output "app_subnet_id" { value = azurerm_subnet.app_subnet.id }
output "db_subnet_id" { value = azurerm_subnet.db_subnet.id }
output "pe_subnet_id" { value = azurerm_subnet.pe_subnet.id }
