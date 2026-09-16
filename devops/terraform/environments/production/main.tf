# ==============================================================================
# CollabPulse - Terraform Environment: PRODUCTION
# ==============================================================================

terraform {
  required_version = ">= 1.7.0"
  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 3.90.0"
    }
  }

  # Section 72: Remote state with state locking and encryption
  backend "azurerm" {
    resource_group_name  = "rg-collabpulse-tfstate"
    storage_account_name = "stcollabpulsetfstateprod"
    container_name       = "tfstate"
    key                  = "production.terraform.tfstate"
  }
}

provider "azurerm" {
  features {}
}

locals {
  environment    = "prod"
  location       = "eastus2"
  location_short = "use2"

  tags = {
    Application = "CollabPulse"
    Environment = "Production"
    Owner       = "InfrastructureTeam"
    CostCenter  = "Core-SaaS-Prod"
    ManagedBy   = "Terraform"
  }
}

resource "azurerm_resource_group" "rg" {
  name     = "rg-collabpulse-${locals.environment}"
  location = locals.location
  tags     = locals.tags
}

# 1. Networking
module "networking" {
  source              = "../../modules/networking"
  environment         = locals.environment
  location            = locals.location
  location_short      = locals.location_short
  resource_group_name = azurerm_resource_group.rg.name
  vnet_cidr           = "10.100.0.0/16"
  tags                = locals.tags
}

# 2. Database (PostgreSQL Flexible Server with HA and 35d PITR)
module "database" {
  source                = "../../modules/database"
  environment           = locals.environment
  location              = locals.location
  resource_group_name   = azurerm_resource_group.rg.name
  vnet_id               = module.networking.vnet_id
  db_subnet_id          = module.networking.db_subnet_id
  admin_password        = var.db_admin_password
  sku_name              = "GP_Standard_D4ds_v5"
  storage_mb            = 131072 # 128 GB
  enable_ha             = true
  backup_retention_days = 35
  geo_redundant_backup  = true
  tags                  = locals.tags
}

# 3. Redis Cache (Premium with clustering, TLS and persistence)
module "redis" {
  source              = "../../modules/redis"
  environment         = locals.environment
  location            = locals.location
  resource_group_name = azurerm_resource_group.rg.name
  pe_subnet_id        = module.networking.pe_subnet_id
  redis_sku           = "Premium"
  redis_capacity      = 2
  enable_persistence  = true
  tags                = locals.tags
}

# 4. Storage (Azure Blob Storage with ZRS and Lifecycle policies)
module "storage" {
  source              = "../../modules/storage"
  environment         = locals.environment
  location            = locals.location
  resource_group_name = azurerm_resource_group.rg.name
  unique_suffix       = "prod01"
  replication_type    = "ZRS"
  tags                = locals.tags
}

# 5. Registry (Azure Container Registry)
module "registry" {
  source              = "../../modules/registry"
  environment         = locals.environment
  location            = locals.location
  resource_group_name = azurerm_resource_group.rg.name
  sku                 = "Premium"
  tags                = locals.tags
}

# 6. Key Vault
module "keyvault" {
  source              = "../../modules/keyvault"
  environment         = locals.environment
  location            = locals.location
  resource_group_name = azurerm_resource_group.rg.name
  tags                = locals.tags
}

# 7. Monitoring & Observability
module "monitoring" {
  source              = "../../modules/monitoring"
  environment         = locals.environment
  location            = locals.location
  resource_group_name = azurerm_resource_group.rg.name
  retention_in_days   = 90
  tags                = locals.tags
}

# 8. Application (Container Apps)
module "app" {
  source                         = "../../modules/app"
  environment                    = locals.environment
  location                       = locals.location
  resource_group_name            = azurerm_resource_group.rg.name
  app_subnet_id                  = module.networking.app_subnet_id
  log_analytics_id               = module.monitoring.log_analytics_id
  acr_login_server               = module.registry.acr_login_server
  app_insights_connection_string = module.monitoring.app_insights_connection_string
  api_min_replicas               = 3
  api_max_replicas               = 20
  tags                           = locals.tags
}

variable "db_admin_password" {
  type      = string
  sensitive = true
}
