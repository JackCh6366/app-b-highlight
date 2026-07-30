import React, { useState, useRef, useEffect, useLayoutEffect, useCallback } from 'react';
import {
  Network,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Minimize2,
  Copy,
  Check,
  FolderTree,
  Eye,
  EyeOff
} from 'lucide-react';
import { MindMapNode } from '../types';

interface MindMapViewerProps {
  data: MindMapNode;
}

// Level color styling matching professional mind-mapping software
const getLevelStyle = (level: number) => {
  switch (level) {
    case 0: // Root
      return 'bg-[#7C8CF8] text-white border-[#6366F1] font-bold text-sm sm:text-base px-5 py-2.5 rounded-xl shadow-md';
    case 1: // Main branches
      return 'bg-[#93C5FD] text-[#1E293B] border-[#60A5FA] font-bold text-xs sm:text-sm px-4 py-2 rounded-lg shadow-sm';
    case 2: // Sub-branches
      return 'bg-[#A7F3D0] text-[#064E3B] border-[#34D399] font-semibold text-xs px-3.5 py-1.5 rounded-lg shadow-sm';
    case 3: // Detail nodes
      return 'bg-[#FEF08A] text-[#713F12] border-[#FDE047] font-medium text-xs px-3 py-1.5 rounded-lg shadow-sm';
    default: // Deeper levels
      return 'bg-white text-[#1A1A1A] border-[#1A1A1A]/20 font-normal text-xs px-3 py-1 rounded-lg shadow-sm';
  }
};

const getLineColor = (level: number) => {
  switch (level) {
    case 0:
      return '#818CF8'; // Indigo-400
    case 1:
      return '#60A5FA'; // Blue-400
    case 2:
      return '#34D399'; // Emerald-400
    default:
      return '#A1A1AA'; // Zinc-400
  }
};

interface TreeNodeProps {
  node: MindMapNode;
  level: number;
  collapsedNodes: Set<string>;
  toggleCollapse: (id: string) => void;
  registerNodeRef: (id: string, el: HTMLDivElement | null) => void;
  selectedNodeId: string | null;
  setSelectedNodeId: (id: string | null) => void;
}

const TreeNode: React.FC<TreeNodeProps> = ({
  node,
  level,
  collapsedNodes,
  toggleCollapse,
  registerNodeRef,
  selectedNodeId,
  setSelectedNodeId,
}) => {
  const hasChildren = Boolean(node.children && node.children.length > 0);
  const isCollapsed = collapsedNodes.has(node.id || node.label);
  const isSelected = selectedNodeId === (node.id || node.label);

  const levelClass = getLevelStyle(level);

  return (
    <div className="flex items-center my-3 relative group">
      {/* Node Box */}
      <div
        ref={(el) => registerNodeRef(node.id || node.label, el)}
        onClick={() => setSelectedNodeId(node.id || node.label)}
        className={`flex items-center gap-1.5 transition-all cursor-pointer border select-none ${levelClass} ${
          isSelected ? 'ring-2 ring-offset-2 ring-[#1A1A1A] scale-[1.03]' : 'hover:scale-[1.02]'
        }`}
      >
        <span>{node.label}</span>
      </div>

      {/* Collapse/Expand Toggle Button */}
      {hasChildren && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            toggleCollapse(node.id || node.label);
          }}
          className="ml-1 z-10 w-5 h-5 rounded-full bg-white border border-[#1A1A1A]/30 text-[#1A1A1A] hover:bg-[#1A1A1A] hover:text-white flex items-center justify-center text-[10px] shadow-sm transition-transform active:scale-95"
          title={isCollapsed ? '展開子節點' : '折疊子節點'}
        >
          {isCollapsed ? (
            <ChevronRight className="w-3 h-3 ml-0.5" />
          ) : (
            <ChevronLeft className="w-3 h-3 mr-0.5" />
          )}
        </button>
      )}

      {/* Children Column */}
      {hasChildren && !isCollapsed && (
        <div className="flex flex-col ml-12 pl-2 border-l-0 relative">
          {node.children!.map((child) => (
            <TreeNode
              key={child.id || child.label}
              node={child}
              level={level + 1}
              collapsedNodes={collapsedNodes}
              toggleCollapse={toggleCollapse}
              registerNodeRef={registerNodeRef}
              selectedNodeId={selectedNodeId}
              setSelectedNodeId={setSelectedNodeId}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export const MindMapViewer: React.FC<MindMapViewerProps> = ({ data }) => {
  const [scale, setScale] = useState(1);
  const [collapsedNodes, setCollapsedNodes] = useState<Set<string>>(new Set());
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [lines, setLines] = useState<
    Array<{ id: string; x1: number; y1: number; x2: number; y2: number; color: string }>
  >([]);

  const containerRef = useRef<HTMLDivElement>(null);
  const nodeRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  const registerNodeRef = useCallback((id: string, el: HTMLDivElement | null) => {
    if (el) {
      nodeRefs.current.set(id, el);
    } else {
      nodeRefs.current.delete(id);
    }
  }, []);

  const toggleCollapse = useCallback((id: string) => {
    setCollapsedNodes((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  // Collect all node IDs that have children for expand/collapse all
  const getAllParentNodeIds = useCallback((node: MindMapNode): string[] => {
    let ids: string[] = [];
    if (node.children && node.children.length > 0) {
      ids.push(node.id || node.label);
      node.children.forEach((c) => {
        ids = ids.concat(getAllParentNodeIds(c));
      });
    }
    return ids;
  }, []);

  const handleExpandAll = () => {
    setCollapsedNodes(new Set());
  };

  const handleCollapseAll = () => {
    if (!data) return;
    const allParents = getAllParentNodeIds(data);
    setCollapsedNodes(new Set(allParents));
  };

  // Calculate SVG connector curved lines between parent nodes and child nodes
  const updateLines = useCallback(() => {
    if (!containerRef.current) return;
    const containerRect = containerRef.current.getBoundingClientRect();
    const newLines: Array<{ id: string; x1: number; y1: number; x2: number; y2: number; color: string }> = [];

    const traverse = (node: MindMapNode, level: number) => {
      const parentId = node.id || node.label;
      const isCollapsed = collapsedNodes.has(parentId);

      if (!isCollapsed && node.children && node.children.length > 0) {
        const parentEl = nodeRefs.current.get(parentId);
        if (parentEl) {
          const pRect = parentEl.getBoundingClientRect();
          // X1: Right side of parent node
          const x1 = (pRect.right - containerRect.left) / scale;
          // Y1: Center Y of parent node
          const y1 = (pRect.top + pRect.height / 2 - containerRect.top) / scale;

          node.children.forEach((child) => {
            const childId = child.id || child.label;
            const childEl = nodeRefs.current.get(childId);
            if (childEl) {
              const cRect = childEl.getBoundingClientRect();
              // X2: Left side of child node
              const x2 = (cRect.left - containerRect.left) / scale;
              // Y2: Center Y of child node
              const y2 = (cRect.top + cRect.height / 2 - containerRect.top) / scale;

              newLines.push({
                id: `${parentId}->${childId}`,
                x1,
                y1,
                x2,
                y2,
                color: getLineColor(level),
              });

              traverse(child, level + 1);
            }
          });
        }
      }
    };

    if (data) {
      traverse(data, 0);
    }

    setLines(newLines);
  }, [data, collapsedNodes, scale]);

  useLayoutEffect(() => {
    updateLines();
    const timer = setTimeout(updateLines, 50);
    return () => clearTimeout(timer);
  }, [data, collapsedNodes, scale, updateLines]);

  useEffect(() => {
    const handleResize = () => updateLines();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [updateLines]);

  const handleCopyText = () => {
    const formatNodeText = (node: MindMapNode, indent = 0): string => {
      let text = '  '.repeat(indent) + '• ' + node.label + '\n';
      if (node.children) {
        node.children.forEach((c) => {
          text += formatNodeText(c, indent + 1);
        });
      }
      return text;
    };
    if (data) {
      navigator.clipboard.writeText(formatNodeText(data));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (!data) return null;

  return (
    <div className="bg-white border border-[#1A1A1A]/15 rounded-sm p-6 shadow-sm space-y-4">
      {/* Header Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#1A1A1A]/10">
        <div className="flex items-center gap-2">
          <Network className="w-5 h-5 text-[#1A1A1A]" />
          <div>
            <h3 className="text-xs font-black uppercase tracking-[0.2em] text-[#1A1A1A]">
              橫向樹狀演繹心智圖 (Interactive Mind Map)
            </h3>
            <p className="text-[11px] font-serif italic text-[#1A1A1A]/60">
              點擊節點按鈕「＜ / ＞」可自由展開或收合子結構脈絡
            </p>
          </div>
        </div>

        {/* Toolbar controls */}
        <div className="flex items-center flex-wrap gap-2 text-xs">
          <button
            onClick={handleExpandAll}
            className="px-2.5 py-1.5 bg-[#F9F8F6] hover:bg-[#ECEAE4] border border-[#1A1A1A]/20 text-[#1A1A1A] font-bold uppercase text-[10px] tracking-wider transition-colors flex items-center gap-1"
            title="全部展開"
          >
            <Eye className="w-3.5 h-3.5" />
            <span>全部展開</span>
          </button>

          <button
            onClick={handleCollapseAll}
            className="px-2.5 py-1.5 bg-[#F9F8F6] hover:bg-[#ECEAE4] border border-[#1A1A1A]/20 text-[#1A1A1A] font-bold uppercase text-[10px] tracking-wider transition-colors flex items-center gap-1"
            title="全部收合"
          >
            <EyeOff className="w-3.5 h-3.5" />
            <span>全部折疊</span>
          </button>

          <button
            onClick={handleCopyText}
            className="px-2.5 py-1.5 bg-[#F9F8F6] hover:bg-[#ECEAE4] border border-[#1A1A1A]/20 text-[#1A1A1A] font-bold uppercase text-[10px] tracking-wider transition-colors flex items-center gap-1"
            title="複製心智圖大綱"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-700" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? '已複製' : '複製大綱'}</span>
          </button>

          <div className="h-4 w-px bg-[#1A1A1A]/20 mx-1" />

          {/* Zoom Controls */}
          <div className="flex items-center gap-1 bg-[#F9F8F6] border border-[#1A1A1A]/20 p-0.5">
            <button
              onClick={() => setScale((s) => Math.min(s + 0.1, 1.5))}
              className="p-1 hover:bg-[#1A1A1A] hover:text-[#F9F8F6] text-[#1A1A1A] transition-colors"
              title="放大"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <span className="text-[10px] font-mono px-1.5 text-[#1A1A1A]/80">
              {Math.round(scale * 100)}%
            </span>
            <button
              onClick={() => setScale((s) => Math.max(s - 0.1, 0.6))}
              className="p-1 hover:bg-[#1A1A1A] hover:text-[#F9F8F6] text-[#1A1A1A] transition-colors"
              title="縮小"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setScale(1)}
              className="p-1 hover:bg-[#1A1A1A] hover:text-[#F9F8F6] text-[#1A1A1A] transition-colors"
              title="重置比例"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* MindMap Interactive Canvas */}
      <div className="overflow-x-auto overflow-y-auto p-8 bg-[#FAF9F5] border border-[#1A1A1A]/10 min-h-[420px] rounded-sm relative cursor-grab active:cursor-grabbing">
        <div
          ref={containerRef}
          className="relative inline-block min-w-max transition-transform origin-top-left"
          style={{ transform: `scale(${scale})` }}
        >
          {/* SVG Canvas for Curved Connector Lines */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none z-0">
            {lines.map((line) => {
              const dx = line.x2 - line.x1;
              const cp1x = line.x1 + dx * 0.5;
              const cp2x = line.x1 + dx * 0.5;
              const pathData = `M ${line.x1} ${line.y1} C ${cp1x} ${line.y1}, ${cp2x} ${line.y2}, ${line.x2} ${line.y2}`;

              return (
                <path
                  key={line.id}
                  d={pathData}
                  fill="none"
                  stroke={line.color}
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  className="transition-all duration-300"
                />
              );
            })}
          </svg>

          {/* Recursive Mindmap Tree */}
          <div className="relative z-10 py-4 px-2">
            <TreeNode
              node={data}
              level={0}
              collapsedNodes={collapsedNodes}
              toggleCollapse={toggleCollapse}
              registerNodeRef={registerNodeRef}
              selectedNodeId={selectedNodeId}
              setSelectedNodeId={setSelectedNodeId}
            />
          </div>
        </div>
      </div>

      {/* Legend / Color Explanation */}
      <div className="flex flex-wrap items-center gap-4 text-[11px] pt-2 text-[#1A1A1A]/70 font-mono">
        <span className="font-bold uppercase tracking-wider text-[10px] text-[#1A1A1A]">色彩位階說明:</span>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-[#7C8CF8] border border-[#6366F1]" />
          <span>核心主題 (Root)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-[#93C5FD] border border-[#60A5FA]" />
          <span>主要篇章 (Main)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-[#A7F3D0] border border-[#34D399]" />
          <span>次級概念 (Sub)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-[#FEF08A] border border-[#FDE047]" />
          <span>詳細關鍵字 (Detail)</span>
        </div>
      </div>
    </div>
  );
};
