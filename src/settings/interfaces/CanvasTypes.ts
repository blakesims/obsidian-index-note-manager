export interface CanvasNode {
    id: string;
    type: string;
    text: string;
    x: number;
    y: number;
    width: number;
    height: number;
    color: string;
}

export interface CanvasEdge {
    id: string;
    fromNode: string;
    toNode: string;
    fromEnd: string;
    toEnd: string;
    label: string;
    color: string;
}

export interface CanvasData {
    nodes: CanvasNode[];
    edges: CanvasEdge[];
} 