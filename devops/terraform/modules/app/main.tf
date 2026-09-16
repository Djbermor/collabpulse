# ==============================================================================
# CollabPulse - Terraform Module: Azure Container Apps Environment & Services
# ==============================================================================

resource "azurerm_user_assigned_identity" "app_identity" {
  name                = "id-collabpulse-${var.environment}"
  location            = var.location
  resource_group_name = var.resource_group_name
  tags                = var.tags
}

resource "azurerm_container_app_environment" "env" {
  name                       = "cae-collabpulse-${var.environment}"
  location                   = var.location
  resource_group_name        = var.resource_group_name
  log_analytics_workspace_id = var.log_analytics_id
  infrastructure_subnet_id   = var.app_subnet_id

  tags = var.tags
}

# API Container App
resource "azurerm_container_app" "api" {
  name                         = "ca-api-${var.environment}"
  container_app_environment_id = azurerm_container_app_environment.env.id
  resource_group_name          = var.resource_group_name
  revision_mode                = "Single"

  identity {
    type         = "UserAssigned"
    identity_ids = [azurerm_user_assigned_identity.app_identity.id]
  }

  ingress {
    external_enabled = false # Internal only, accessed via gateway / front door
    target_port      = 8080
    traffic_weight {
      percentage      = 100
      latest_revision = true
    }
  }

  template {
    min_replicas = var.api_min_replicas
    max_replicas = var.api_max_replicas

    container {
      name   = "api"
      image  = "${var.acr_login_server}/collabpulse/api:latest"
      cpu    = 1.0
      memory = "2Gi"

      env {
        name  = "ASPNETCORE_ENVIRONMENT"
        value = "Production"
      }
      env {
        name  = "APPLICATIONINSIGHTS_CONNECTION_STRING"
        value = var.app_insights_connection_string
      }

      liveness_probe {
        port      = 8080
        path      = "/health/live"
        transport = "HTTP"
      }

      readiness_probe {
        port      = 8080
        path      = "/health/ready"
        transport = "HTTP"
      }
    }

    # Section 79: Autoscaling on HTTP concurrent requests
    http_scale_rule {
      name                = "http-scaling-rule"
      concurrent_requests = "100"
    }
  }

  tags = var.tags
}

# Background Worker Container App
resource "azurerm_container_app" "worker" {
  name                         = "ca-worker-${var.environment}"
  container_app_environment_id = azurerm_container_app_environment.env.id
  resource_group_name          = var.resource_group_name
  revision_mode                = "Single"

  template {
    min_replicas = 1
    max_replicas = 5

    container {
      name   = "worker"
      image  = "${var.acr_login_server}/collabpulse/worker:latest"
      cpu    = 0.5
      memory = "1Gi"

      env {
        name  = "DOTNET_ENVIRONMENT"
        value = "Production"
      }
    }
  }

  tags = var.tags
}

# Frontend Container App
resource "azurerm_container_app" "frontend" {
  name                         = "ca-frontend-${var.environment}"
  container_app_environment_id = azurerm_container_app_environment.env.id
  resource_group_name          = var.resource_group_name
  revision_mode                = "Single"

  ingress {
    external_enabled = true
    target_port      = 80
    traffic_weight {
      percentage      = 100
      latest_revision = true
    }
  }

  template {
    min_replicas = 2
    max_replicas = 10

    container {
      name   = "frontend"
      image  = "${var.acr_login_server}/collabpulse/frontend:latest"
      cpu    = 0.5
      memory = "1Gi"

      readiness_probe {
        port      = 80
        path      = "/health"
        transport = "HTTP"
      }
    }
  }

  tags = var.tags
}

output "frontend_fqdn" { value = azurerm_container_app.frontend.ingress[0].fqdn }
output "api_fqdn" { value = azurerm_container_app.api.ingress[0].fqdn }
output "identity_id" { value = azurerm_user_assigned_identity.app_identity.id }
