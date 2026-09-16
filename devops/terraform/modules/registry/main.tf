# ==============================================================================
# CollabPulse - Terraform Module: Azure Container Registry (ACR)
# ==============================================================================

resource "azurerm_container_registry" "acr" {
  name                = "acrcollabpulse${var.environment}"
  resource_group_name = var.resource_group_name
  location            = var.location
  sku                 = var.sku
  admin_enabled       = false # Enforce Managed Identity / RBAC authentication

  # Retention policy for untagged images
  retention_policy {
    days    = 30
    enabled = true
  }

  tags = var.tags
}

output "acr_id" { value = azurerm_container_registry.acr.id }
output "acr_login_server" { value = azurerm_container_registry.acr.login_server }
