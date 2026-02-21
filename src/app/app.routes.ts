import { Routes } from '@angular/router';
import { FamilyTreeComponent } from './family-tree/family-tree';

export const routes: Routes = [
    { path: '', redirectTo: 'family-tree', pathMatch: 'full' },
    { path: 'family-tree', component: FamilyTreeComponent },
];
