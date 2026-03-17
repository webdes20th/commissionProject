import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule, NgTemplateOutlet } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { NgbTooltipModule, NgbCollapseModule } from '@ng-bootstrap/ng-bootstrap';

export interface Contract {
    contractNumber: string;
    startDate: string;
    endDate: string;
    agentId: string;
    investorId: string;
    productCode: string;
    contractPeriod: number;
    commissionStart: string;
    commissionEnd: string;
    amount: number;
    status: string;
}

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
    contracts: Contract[];
    summaryTeamValue: number;
    rateTeamValue: number;
    selfCommission: number;
    selfOverRide: number;
    GARate: number | null;
    GAcommission: number | null;
    diffRateCommission: number;
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

    // Side panel state
    selectedMember = signal<FamilyMember | null>(null);
    panelOpen = signal(false);

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
        this.http.get<FamilyTreeResponse>('http://localhost:3001/users/team-cal/family-tree?year=2026&month=2').subscribe({
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

    // ── Side panel ──────────────────────────────────
    openPanel(member: FamilyMember): void {
        this.selectedMember.set(member);
        this.panelOpen.set(true);
    }

    closePanel(): void {
        this.panelOpen.set(false);
        setTimeout(() => this.selectedMember.set(null), 300);
    }

    // ── Type helpers ─────────────────────────────────
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

    // ── Contract helpers ──────────────────────────────
    getTotalAmount(contracts: Contract[]): number {
        return contracts.reduce((sum, c) => sum + c.amount, 0);
    }

    formatAmount(amount: number | null | undefined): string {
        if (amount == null) return '—';
        if (amount >= 1_000_000) {
            const m = amount / 1_000_000;
            return m % 1 === 0 ? `${m}ล้าน` : `${m.toFixed(2).replace(/\.?0+$/, '')}ล้าน`;
        }
        if (amount >= 100_000) {
            const h = amount / 100_000;
            return h % 1 === 0 ? `${h}แสน` : `${h.toFixed(1)}แสน`;
        }
        return amount.toLocaleString('th-TH');
    }

    formatAmountFull(amount: number | null | undefined): string {
        if (amount == null) return '—';
        return '฿' + amount.toLocaleString('th-TH');
    }

    formatRate(rate: number | null | undefined): string {
        // Backend sends the value directly, e.g. 1.2 → display as "1.2%"
        if (rate == null) return '—';
        return `${rate}%`;
    }

    getContractStatusKey(status: string): string {
        return status === 'active' ? 'active' : 'inactive';
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

    trackByContract(_: number, c: Contract): string {
        return c.contractNumber;
    }

    // ── Drag to Scroll ──────────────────────────────────
    private isDragging = false;
    private startX = 0;
    private startY = 0;
    private scrollLeft = 0;
    private scrollTop = 0;
    private windowScrollTop = 0;

    onMouseDown(event: MouseEvent, element: HTMLElement): void {
        if (event.button !== 0) return; // Only allow left-click
        this.isDragging = true;
        element.style.cursor = 'grabbing';
        element.style.userSelect = 'none';
        this.startX = event.clientX;
        this.startY = event.clientY;
        this.scrollLeft = element.scrollLeft;
        this.scrollTop = element.scrollTop;
        this.windowScrollTop = window.scrollY || document.documentElement.scrollTop;
    }

    onMouseLeave(element: HTMLElement): void {
        this.isDragging = false;
        element.style.removeProperty('cursor');
        element.style.removeProperty('user-select');
    }

    onMouseUp(element: HTMLElement): void {
        this.isDragging = false;
        element.style.removeProperty('cursor');
        element.style.removeProperty('user-select');
    }

    onMouseMove(event: MouseEvent, element: HTMLElement): void {
        if (!this.isDragging) return;
        event.preventDefault();
        const x = event.clientX;
        const y = event.clientY;
        const walkX = (x - this.startX) * 1; // Scroll-fast multiplier
        const walkY = (y - this.startY) * 1;

        element.scrollLeft = this.scrollLeft - walkX;
        element.scrollTop = this.scrollTop - walkY;
        window.scrollTo(window.scrollX, this.windowScrollTop - walkY);
    }
}
