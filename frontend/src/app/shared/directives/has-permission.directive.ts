import { Directive, Input, TemplateRef, ViewContainerRef, effect } from '@angular/core';
import { PermissionService } from '../../core/permissions/permission.service';
import { SystemPermission } from '../../core/models/permission.model';

@Directive({
  selector: '[appHasPermission]',
  standalone: true
})
export class HasPermissionDirective {
  private requiredPermission?: SystemPermission;
  private isRendered = false;

  @Input() set appHasPermission(permission: SystemPermission) {
    this.requiredPermission = permission;
    this.updateView();
  }

  constructor(
    private templateRef: TemplateRef<any>,
    private viewContainer: ViewContainerRef,
    private permissionService: PermissionService
  ) {
    // Re-evaluate when current role/permissions signal changes
    effect(() => {
      this.permissionService.grantedPermissions();
      this.updateView();
    });
  }

  private updateView(): void {
    if (!this.requiredPermission) {
      this.render();
      return;
    }

    const hasAccess = this.permissionService.hasPermission(this.requiredPermission);
    if (hasAccess && !this.isRendered) {
      this.render();
    } else if (!hasAccess && this.isRendered) {
      this.clear();
    }
  }

  private render(): void {
    this.viewContainer.createEmbeddedView(this.templateRef);
    this.isRendered = true;
  }

  private clear(): void {
    this.viewContainer.clear();
    this.isRendered = false;
  }
}
