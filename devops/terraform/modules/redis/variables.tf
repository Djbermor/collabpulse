variable "environment" { type = string }
variable "location" { type = string }
variable "resource_group_name" { type = string }
variable "pe_subnet_id" { type = string }
variable "redis_sku" { type = string; default = "Premium" }
variable "redis_family" { type = string; default = "P" }
variable "redis_capacity" { type = number; default = 1 }
variable "enable_persistence" { type = bool; default = true }
variable "tags" { type = map(string) }

output "redis_id" { value = azurerm_redis_cache.redis.id }
output "redis_hostname" { value = azurerm_redis_cache.redis.hostname }
output "redis_ssl_port" { value = azurerm_redis_cache.redis.ssl_port }
output "redis_primary_access_key" { value = azurerm_redis_cache.redis.primary_access_key; sensitive = true }
