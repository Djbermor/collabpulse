# ==============================================================================
# CollabPulse - Terraform Module: PostgreSQL Flexible Server (Production Grade)
# ==============================================================================

resource "azurerm_private_dns_zone" "postgres_dns" {
  name                = "collabpulse-${var.environment}.postgres.database.azure.com"
  resource_group_name = var.resource_group_name
  tags                = var.tags
}

resource "azurerm_private_dns_zone_virtual_network_link" "postgres_dns_link" {
  name                  = "postgres-dns-link-${var.environment}"
  private_dns_zone_name = azurerm_private_dns_zone.postgres_dns.name
  virtual_network_id    = var.vnet_id
  resource_group_name   = var.resource_group_name
}

resource "azurerm_postgresql_flexible_server" "postgres" {
  name                   = "psql-collabpulse-${var.environment}"
  resource_group_name    = var.resource_group_name
  location               = var.location
  version                = "16"
  delegated_subnet_id    = var.db_subnet_id
  private_dns_zone_id    = azurerm_private_dns_zone.postgres_dns.id
  administrator_login    = var.admin_username
  administrator_password = var.admin_password

  storage_mb   = var.storage_mb
  storage_tier = "P10"
  sku_name     = var.sku_name

  # Section 9 & 21: High Availability & Backups
  backup_retention_days        = var.backup_retention_days
  geo_redundant_backup_enabled = var.geo_redundant_backup

  dynamic "high_availability" {
    for_each = var.enable_ha ? [1] : []
    content {
      mode                      = "ZoneRedundant"
      standby_availability_zone = var.standby_zone
    }
  }

  tags = var.tags

  depends_on = [azurerm_private_dns_zone_virtual_network_link.postgres_dns_link]
}

# Production database for the application
resource "azurerm_postgresql_flexible_server_database" "app_db" {
  name      = "collabpulse_${var.environment}"
  server_id = azurerm_postgresql_flexible_server.postgres.id
  collation = "en_US.utf8"
  charset   = "utf8"
}

# Optimized PostgreSQL Configuration
resource "azurerm_postgresql_flexible_server_configuration" "connection_pooling" {
  name      = "connection_throttling"
  server_id = azurerm_postgresql_flexible_server.postgres.id
  value     = "on"
}

resource "azurerm_postgresql_flexible_server_configuration" "log_connections" {
  name      = "log_connections"
  server_id = azurerm_postgresql_flexible_server.postgres.id
  value     = "on"
}
