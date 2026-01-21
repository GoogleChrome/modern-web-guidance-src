---
description: Reduce JavaScript bundle size and improve initial load times by implementing route-level code splitting in Angular applications.
filename: route-level-code-splitting-angular
category: webperf
---

# Route-level code splitting in Angular

Route-level code splitting allows you to divide your Angular application's JavaScript into smaller chunks, loaded only when a specific route is accessed. This significantly reduces the initial bundle size, leading to faster load times and improved performance, especially on mobile devices.

## Best Practices

When implementing route-level code splitting in Angular, follow these best practices:

### Dynamic Module Loading

Use the `loadChildren` property in your route configuration to specify a dynamic import for the module associated with the route. This ensures the module's code is only fetched when the user navigates to that route.

```javascript
{
  path: 'feature',
  loadChildren: () => import('./feature/feature.module').then(m => m.FeatureModule)
}
```

- **DO** use `loadChildren` instead of `component` for lazy-loaded routes.
- **DO** return the module from the dynamic import's resolved promise.

### Lazy-Loaded Module Structure

Organize your lazy-loaded features into separate modules. Each module should define its own routes using `RouterModule.forChild()`, including a default route that renders the primary component for that feature.

```javascript
// feature-routing.module.ts
import { NgModule } from '@angular/core';
import { RouterModule } from '@angular/router';
import { FeatureComponent } from './feature.component';

@NgModule({
  imports: [
    RouterModule.forChild([{
      path: '',
      component: FeatureComponent,
      pathMatch: 'full'
    }])
  ]
})
export class FeatureRoutingModule {}

// feature.module.ts
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FeatureComponent } from './feature.component';
import { FeatureRoutingModule } from './feature-routing.module';

@NgModule({
  declarations: [FeatureComponent],
  imports: [
    CommonModule,
    FeatureRoutingModule
  ]
})
export class FeatureModule {}
```

### User Feedback During Loading

Provide visual feedback to the user while the lazy-loaded module is being fetched. This can be achieved by listening to router events and displaying a loading indicator.

- **DO** subscribe to `router.events` in your `AppComponent`.
- **DO** set a loading flag to `true` on `NavigationStart` and `false` on `NavigationEnd`.
- **DO** display a visual indicator (e.g., a spinner) when the loading flag is true.

```html
<!-- app.component.html -->
<router-outlet></router-outlet>
<span class="loader" *ngIf="loading"></span>
```

```typescript
// app.component.ts
import { Component } from '@angular/core';
import { Router, NavigationStart, NavigationEnd, RouterEvent } from '@angular/router';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent {
  loading: boolean = false;

  constructor(private router: Router) {
    this.router.events.subscribe((event: RouterEvent): void => {
      if (event instanceof NavigationStart) {
        this.loading = true;
      } else if (event instanceof NavigationEnd) {
        this.loading = false;
      }
    });
  }
}
```

### CLI Generation

Leverage the Angular CLI to automate the generation of lazy-loaded modules and routes. This streamlines the setup process and ensures correct configuration.

```bash
ng g module <module-name> --module app --route <route-path>
```

- **DO** use the CLI command to generate new lazy-loaded modules and their associated routes.

## Considerations

While route-level code splitting significantly improves initial load performance, it can introduce a slight delay for subsequent navigations as new chunks need to be fetched. Consider implementing route preloading strategies to mitigate this effect in a future step.