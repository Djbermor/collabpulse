# ==============================================================================
# CollabPulse - Terraform Environment: STAGING
# ==============================================================================

terraform {
  required_version = ">= 1.7.0"
  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 3.90.0"
    }
  }

  backend "azurerm" {
    resource_group_name  = "rg-collabpulse-tfstate"
    storage_account_name = "stcollabpulsetfstatestg"
    container_name       = "tfstate"
    key                  = "staging.terraform.tfstate"
  }
}

provider "azurerm" {
  features {}
}

locals {
  environment    = "stg"
  location       = "eastus2"
  location_short = "use2"

  tags = {
    Application = "CollabPulse"
    Environment = "Staging"
    Owner       = "QA-DevOps"
    ManagedBy   = "Terraform"
  }
}

resource "azurerm_resource_group" "rg" {
  name     = "rg-collabpulse-${locals.environment}"
  location = locals.location
  tags     = locals.tags
}

module "networking" {
  source              = "../../modules/networking"
  environment         = locals.environment
  location            = locals.location
  location_short      = locals.location_short
  resource_group_name = azurerm_resource_group.rg.name
  vnet_cidr           = "10.200.0.0/16"
  tags                = locals.tags
}

module "database" {
  source                = "../../modules/database"
  environment           = locals.environment
  location              = locals.location
  resource_group_name   = azurerm_resource_group.rg.name
  vnet_id               = module.networking.vnet_id
  db_subnet_id          = module.networking.db_subnet_id
  admin_password        = var.db_admin_password
  sku_name              = "B_Standard_B2s"
  storage_mb            = 32768
  enable_ha             = false
  backup_retention_days = 7
  geo_redundant_backup  = false
  tags                  = locals.tags
}

module "redis" {
  source              = "../../modules/redis"
  environment         = locals.environment
  location            = locals.location
  resource_group_name = azurerm_resource_group.rg.name
  pe_subnet_id        = module.networking.pe_subnet_id
  redis_sku           = "Standard"
  redis_family        = "C"
  redis_capacity      = 1
  enable_persistence  = false
  tags                = locals.tags
}

module "storage" {
  source              = "../../modules/storage"
  environment         = locals.environment
  location            = locals.location
  resource_group_name = azurerm_resource_group.rg.name
  unique_suffix       = "stg01"
  replication_type    = "LRS"
  tags                = locals.tags
}

module "registry" {
  source              = "../../modules/registry"
  environment         = locals.environment
  location            = locals.location
  resource_group_name = azurerm_resource_group.rg.name
  sku                 = "Standard"
  tags                = locals.tags
}

module "keyvault" {
  source              = "../../modules/keyvault"
  environment         = locals.environment
  location            = locals.location
  resource_group_name = azurerm_resource_group.rg.name
  tags                = locals.tags
}

module "monitoring" {
  source              = "../../modules/monitoring"
  environment         = locals.environment
  location            = locals.location
  resource_group_name = azurerm_resource_group.rg.name
  retention_in_days   = 30
  tags                = locals.tags
}

module "app" {
  source                         = "../../modules/app"
  environment                    = locals.environment
  location                       = locals.location
  resource_group_name            = azurerm_resource_group.rg.name
  app_subnet_id                  = module.networking.app_subnet_id
  log_analytics_id               = module.monitoring.log_analytics_id
  acr_login_server               = module.registry.acr_login_server
  app_insights_connection_string = module.monitoring.app_insights_connection_string
  api_min_replicas               = 1
  api_max_replicas               = 3
  tags                           = locals.tags
}

variable "db_admin_password" {
  type      = string
  sensitive = true
}
