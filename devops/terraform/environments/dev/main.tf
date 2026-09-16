# ==============================================================================
# CollabPulse - Terraform Environment: DEVELOPMENT
# ==============================================================================

terraform {
  required_version = ">= 1.7.0"
  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 3.90.0"
    }
  }
}

provider "azurerm" {
  features {}
}

locals {
  environment = "dev"
  location    = "eastus2"
  tags = {
    Application = "CollabPulse"
    Environment = "Development"
  }
}

resource "azurerm_resource_group" "rg" {
  name     = "rg-collabpulse-dev"
  location = locals.location
  tags     = locals.tags
}
