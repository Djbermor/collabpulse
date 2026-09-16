# ==============================================================================
# CollabPulse - Terraform Module: Azure Cache for Redis (Production Grade)
# ==============================================================================

resource "azurerm_redis_cache" "redis" {
  name                = "redis-collabpulse-${var.environment}"
  location            = var.location
  resource_group_name = var.resource_group_name
  capacity            = var.redis_capacity
  family              = var.redis_family
  sku_name            = var.redis_sku
  enable_non_ssl_port = false
  minimum_tls_version = "1.2"

  redis_configuration {
    enable_authentication = true
    maxmemory_reserved    = 50
    maxmemory_delta       = 50
    maxmemory_policy      = "volatile-lru"
    rdb_backup_enabled    = var.enable_persistence
    rdb_backup_frequency  = 60
    rdb_backup_max_snapshot_count = 1
  }

  tags = var.tags
}

# Private Endpoint for Redis Cache
resource "azurerm_private_endpoint" "redis_pe" {
  name                = "pe-redis-${var.environment}"
  location            = var.location
  resource_group_name = var.resource_group_name
  subnet_id           = var.pe_subnet_id

  private_service_connection {
    name                           = "psc-redis-${var.environment}"
    private_connection_resource_id = azurerm_redis_cache.redis.id
    is_manual_connection           = false
    subresource_names              = ["redisCache"]
  }

  tags = var.tags
}
