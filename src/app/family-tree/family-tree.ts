import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule, NgTemplateOutlet } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { NgbTooltipModule, NgbCollapseModule } from '@ng-bootstrap/ng-bootstrap';

export interface FamilyMember {
    id: number;
    type: string;
    checkedDate: string;
    checkedStatus: boolean | null;
    userId: number;
    parentId: number | null;
    title: string;
    firstName: string;
    lastName: string;
    agentId: string | null;
    createdAt: string;
    updatedAt: string;
    children: FamilyMember[];
    // UI state
    collapsed?: boolean;
}

export interface FamilyTreeResponse {
    message: string;
    responseCode: string;
    successful: boolean;
    data: {
        totalMembers: number;
        familyTree: FamilyMember[];
    };
    httpStatus: number;
}

@Component({
    selector: 'app-family-tree',
    standalone: true,
    imports: [CommonModule, NgTemplateOutlet, FormsModule, NgbTooltipModule, NgbCollapseModule],
    templateUrl: './family-tree.html',
    styleUrl: './family-tree.scss',
})
export class FamilyTreeComponent implements OnInit {
    private http = inject(HttpClient);

    loading = signal(true);
    error = signal<string | null>(null);
    totalMembers = signal(0);
    familyTree = signal<FamilyMember[]>([]);
    searchQuery = signal('');
    expandAll = signal(false);

    filteredTree = computed(() => {
        const q = this.searchQuery().toLowerCase().trim();
        if (!q) return this.familyTree();
        return this.filterTree(this.familyTree(), q);
    });

    private filterTree(nodes: FamilyMember[], q: string): FamilyMember[] {
        const result: FamilyMember[] = [];
        for (const node of nodes) {
            const fullName = `${node.title} ${node.firstName} ${node.lastName}`.toLowerCase();
            const agentId = (node.agentId ?? '').toLowerCase();
            const matches = fullName.includes(q) || agentId.includes(q) || node.type.toLowerCase().includes(q);
            const filteredChildren = this.filterTree(node.children, q);
            if (matches || filteredChildren.length) {
                result.push({ ...node, children: filteredChildren, collapsed: false });
            }
        }
        return result;
    }

    ngOnInit(): void {
        this.fetchFamilyTree();
    }

    fetchFamilyTree(): void {
        this.loading.set(true);
        this.error.set(null);
        this.http.get<FamilyTreeResponse>('http://localhost:3001/users/team-cal/family-tree').subscribe({
            next: (res) => {
                if (res.successful) {
                    this.totalMembers.set(res.data.totalMembers);
                    this.familyTree.set(this.initCollapsed(res.data.familyTree, 0));
                } else {
                    this.error.set('Failed to load family tree data.');
                }
                this.loading.set(false);
            },
            error: (err) => {
                this.error.set('Unable to connect to the server. Please try again.');
                this.loading.set(false);
                console.error(err);
            },
        });
    }

    private initCollapsed(nodes: FamilyMember[], depth: number): FamilyMember[] {
        return nodes.map((n) => ({
            ...n,
            collapsed: depth >= 2,
            children: this.initCollapsed(n.children, depth + 1),
        }));
    }

    toggleNode(node: FamilyMember): void {
        node.collapsed = !node.collapsed;
    }

    toggleExpandAll(): void {
        this.expandAll.update((v) => !v);
        this.setAllCollapsed(this.familyTree(), this.expandAll());
    }

    private setAllCollapsed(nodes: FamilyMember[], collapsed: boolean): void {
        nodes.forEach((n) => {
            n.collapsed = !collapsed;
            if (n.children.length) this.setAllCollapsed(n.children, collapsed);
        });
    }

    getTypeKey(type: string): string {
        const map: Record<string, string> = {
            'Agent Type 1': 'type1',
            'Agent Type 2': 'type2',
            'GA Type': 'ga',
        };
        return map[type] ?? 'default';
    }

    getStatusKey(status: boolean | null): string {
        if (status === null) return 'pending';
        return status ? 'active' : 'inactive';
    }

    getStatusLabel(status: boolean | null): string {
        if (status === null) return 'รอผล';
        return status ? 'ผ่านแล้ว' : 'ยังไม่ผ่าน';
    }

    countDescendants(node: FamilyMember): number {
        let count = node.children.length;
        for (const child of node.children) {
            count += this.countDescendants(child);
        }
        return count;
    }

    trackById(_: number, node: FamilyMember): number {
        return node.id;
    }
}

