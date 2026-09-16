# ==============================================================================
# CollabPulse - Terraform Module: Monitoring, Observability & Alerts
# ==============================================================================

resource "azurerm_log_analytics_workspace" "law" {
  name                = "law-collabpulse-${var.environment}"
  location            = var.location
  resource_group_name = var.resource_group_name
  sku                 = "PerGB2018"
  retention_in_days   = var.retention_in_days

  tags = var.tags
}

resource "azurerm_application_insights" "app_insights" {
  name                = "appi-collabpulse-${var.environment}"
  location            = var.location
  resource_group_name = var.resource_group_name
  workspace_id        = azurerm_log_analytics_workspace.law.id
  application_type    = "web"

  tags = var.tags
}

# Action Group for PagerDuty / DevOps Engineers
resource "azurerm_monitor_action_group" "devops_alerts" {
  name                = "ag-collabpulse-${var.environment}"
  resource_group_name = var.resource_group_name
  short_name          = "CollabAlert"

  email_receiver {
    name                    = "DevOpsTeam"
    email_address           = var.alert_email
    use_common_alert_schema = true
  }
}

# Alert: 5xx Spike (> 1% error rate)
resource "azurerm_monitor_metric_alert" "http_5xx_alert" {
  name                = "alert-high-5xx-rate-${var.environment}"
  resource_group_name = var.resource_group_name
  scopes              = [azurerm_application_insights.app_insights.id]
  description         = "Triggers when HTTP 5xx error rate exceeds 1% over 5 minutes"
  severity            = 1
  frequency           = "PT1M"
  window_size         = "PT5M"

  criteria {
    metric_namespace = "microsoft.insights/components"
    metric_name      = "requests/failed"
    aggregation      = "Count"
    operator         = "GreaterThan"
    threshold        = 10
  }

  action {
    action_group_id = azurerm_monitor_action_group.devops_alerts.id
  }
}

output "log_analytics_id" { value = azurerm_log_analytics_workspace.law.id }
output "app_insights_key" { value = azurerm_application_insights.app_insights.instrumentation_key; sensitive = true }
output "app_insights_connection_string" { value = azurerm_application_insights.app_insights.connection_string; sensitive = true }
