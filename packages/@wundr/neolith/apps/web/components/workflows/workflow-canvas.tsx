'use client';

import type {
  Connection,
  Edge,
  Node,
  NodeTypes} from '@xyflow/react';

import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  MarkerType,
  Panel,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import {
  Zap,
  Plus,
  Settings,
  Trash2,
  Copy,
  Play,
  Save,
  Undo,
  Redo,
  ZoomIn,
  ZoomOut,
  Maximize,
} from 'lucide-react';
import { useCallback, useEffect, useState, useMemo } from 'react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import {
  TRIGGER_TYPE_CONFIG,
  ACTION_TYPE_CONFIG,
  DEFAULT_ACTION_CONFIGS,
} from '@/types/workflow';

import type {
  Workflow,
  TriggerConfig,
  ActionConfig,
  ActionId,
  CreateWorkflowInput,
} from '@/types/workflow';

// =============================================================================
// Types
// =============================================================================

interface WorkflowCanvasProps {
  workflow?: Partial<Workflow>;
  onSave: (workflow: CreateWorkflowInput) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
  className?: string;
}

interface NodeData extends Record<string, unknown> {
  type: 'trigger' | 'action';
  label: string;
  description?: string;
  config: TriggerConfig | ActionConfig;
  onEdit: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
}

// =============================================================================
// Custom Node Components
// =============================================================================

function TriggerNode({ data }: { data: NodeData }) {
  return (
    <div className='group min-w-[280px] rounded-lg border-2 border-purple-500 bg-gradient-to-br from-purple-50 to-purple-100 p-4 shadow-lg dark:from-purple-950 dark:to-purple-900'>
      <div className='flex items-start justify-between gap-2'>
        <div className='flex items-start gap-3'>
          <div className='rounded-md bg-purple-500 p-2 text-white'>
            <Zap className='h-5 w-5' />
          </div>
          <div className='flex-1'>
            <div className='flex items-center gap-2'>
              <h3 className='font-semibold text-purple-900 dark:text-purple-100'>
                {data.label}
              </h3>
              <span className='rounded-full bg-purple-500 px-2 py-0.5 text-xs font-medium text-white'>
                Trigger
              </span>
            </div>
            {data.description && (
              <p className='mt-1 text-sm text-purple-700 dark:text-purple-300'>
                {data.description}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Action buttons - shown on hover */}
      <div className='mt-3 flex gap-2 opacity-0 transition-opacity group-hover:opacity-100'>
        <button
          type='button'
          onClick={data.onEdit}
          className='rounded-md border border-purple-300 bg-white px-3 py-1 text-xs font-medium text-purple-700 transition-colors hover:bg-purple-50 dark:border-purple-700 dark:bg-purple-900 dark:text-purple-300 dark:hover:bg-purple-800'
        >
          <Settings className='inline h-3 w-3 mr-1' />
          Edit
        </button>
      </div>
    </div>
  );
}

function ActionNode({ data }: { data: NodeData }) {
  return (
    <div className='group min-w-[280px] rounded-lg border-2 border-blue-500 bg-gradient-to-br from-blue-50 to-blue-100 p-4 shadow-lg dark:from-blue-950 dark:to-blue-900'>
      <div className='flex items-start justify-between gap-2'>
        <div className='flex items-start gap-3'>
          <div className='rounded-md bg-blue-500 p-2 text-white'>
            <Play className='h-5 w-5' />
          </div>
          <div className='flex-1'>
            <div className='flex items-center gap-2'>
              <h3 className='font-semibold text-blue-900 dark:text-blue-100'>
                {data.label}
              </h3>
              <span className='rounded-full bg-blue-500 px-2 py-0.5 text-xs font-medium text-white'>
                Action
              </span>
            </div>
            {data.description && (
              <p className='mt-1 text-sm text-blue-700 dark:text-blue-300'>
                {data.description}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Action buttons - shown on hover */}
      <div className='mt-3 flex gap-2 opacity-0 transition-opacity group-hover:opacity-100'>
        <button
          type='button'
          onClick={data.onEdit}
          className='rounded-md border border-blue-300 bg-white px-3 py-1 text-xs font-medium text-blue-700 transition-colors hover:bg-blue-50 dark:border-blue-700 dark:bg-blue-900 dark:text-blue-300 dark:hover:bg-blue-800'
        >
          <Settings className='inline h-3 w-3 mr-1' />
          Edit
        </button>
        <button
          type='button'
          onClick={data.onDuplicate}
          className='rounded-md border border-blue-300 bg-white px-3 py-1 text-xs font-medium text-blue-700 transition-colors hover:bg-blue-50 dark:border-blue-700 dark:bg-blue-900 dark:text-blue-300 dark:hover:bg-blue-800'
        >
          <Copy className='inline h-3 w-3 mr-1' />
          Duplicate
        </button>
        <button
          type='button'
          onClick={data.onDelete}
          className='rounded-md border border-red-300 bg-white px-3 py-1 text-xs font-medium text-red-700 transition-colors hover:bg-red-50 dark:border-red-700 dark:bg-red-900 dark:text-red-300 dark:hover:bg-red-800'
        >
          <Trash2 className='inline h-3 w-3 mr-1' />
          Delete
        </button>
      </div>
    </div>
  );
}

const nodeTypes: NodeTypes = {
  trigger: TriggerNode,
  action: ActionNode,
};

// =============================================================================
// Main Canvas Component
// =============================================================================

export function WorkflowCanvas({
  workflow,
  onSave,
  onCancel,
  isLoading = false,
  className,
}: WorkflowCanvasProps) {
  // Workflow metadata
  const [name, setName] = useState(workflow?.name || '');
  const [description, setDescription] = useState(workflow?.description || '');

  // Canvas state
  const [nodes, setNodes, onNodesChange] = useNodesState<Node<NodeData>>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  // UI state
  const [showAddActionDialog, setShowAddActionDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [selectedNode, setSelectedNode] = useState<Node<NodeData> | null>(null);
  const [editingConfig, setEditingConfig] = useState<
    TriggerConfig | ActionConfig | null
  >(null);

  // History for undo/redo
  const [history, setHistory] = useState<
    { nodes: Node<NodeData>[]; edges: Edge[] }[]
  >([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  // Initialize from workflow prop
  useEffect(() => {
    if (workflow) {
      const newNodes: Node<NodeData>[] = [];
      const newEdges: Edge[] = [];

      // Add trigger node
      if (workflow.trigger) {
        const triggerConfig = TRIGGER_TYPE_CONFIG[workflow.trigger.type];
        newNodes.push({
          id: 'trigger',
          type: 'trigger',
          position: { x: 400, y: 50 },
          data: {
            type: 'trigger',
            label: triggerConfig.label,
            description: triggerConfig.description,
            config: workflow.trigger,
            onEdit: () => handleEditNode('trigger'),
            onDelete: () => {},
            onDuplicate: () => {},
          },
        });
      }

      // Add action nodes
      if (workflow.actions) {
        workflow.actions.forEach((action, index) => {
          const actionConfig = ACTION_TYPE_CONFIG[action.type];
          const nodeId = `action-${index}`;

          newNodes.push({
            id: nodeId,
            type: 'action',
            position: { x: 400, y: 250 + index * 200 },
            data: {
              type: 'action',
              label: actionConfig.label,
              description: actionConfig.description,
              config: action,
              onEdit: () => handleEditNode(nodeId),
              onDelete: () => handleDeleteNode(nodeId),
              onDuplicate: () => handleDuplicateNode(nodeId),
            },
          });

          // Connect to previous node
          const sourceId = index === 0 ? 'trigger' : `action-${index - 1}`;
          newEdges.push({
            id: `${sourceId}-${nodeId}`,
            source: sourceId,
            target: nodeId,
            type: 'smoothstep',
            animated: true,
            markerEnd: {
              type: MarkerType.ArrowClosed,
            },
          });
        });
      }

      setNodes(newNodes);
      setEdges(newEdges);
      saveToHistory(newNodes, newEdges);
    }
  }, [workflow]);

  // Save current state to history
  const saveToHistory = useCallback(
    (currentNodes: Node<NodeData>[], currentEdges: Edge[]) => {
      const newHistory = history.slice(0, historyIndex + 1);
      newHistory.push({
        nodes: JSON.parse(JSON.stringify(currentNodes)),
        edges: JSON.parse(JSON.stringify(currentEdges)),
      });
      setHistory(newHistory);
      setHistoryIndex(newHistory.length - 1);
    },
    [history, historyIndex],
  );

  // Undo/Redo
  const handleUndo = useCallback(() => {
    if (historyIndex > 0) {
      const prevState = history[historyIndex - 1];
      setNodes(prevState.nodes);
      setEdges(prevState.edges);
      setHistoryIndex(historyIndex - 1);
    }
  }, [history, historyIndex, setNodes, setEdges]);

  const handleRedo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const nextState = history[historyIndex + 1];
      setNodes(nextState.nodes);
      setEdges(nextState.edges);
      setHistoryIndex(historyIndex + 1);
    }
  }, [history, historyIndex, setNodes, setEdges]);

  // Connection handler
  const onConnect = useCallback(
    (connection: Connection) => {
      setEdges(eds =>
        addEdge(
          {
            ...connection,
            type: 'smoothstep',
            animated: true,
            markerEnd: {
              type: MarkerType.ArrowClosed,
            },
          },
          eds,
        ),
      );
    },
    [setEdges],
  );

  // Add action node
  const handleAddAction = useCallback(
    (actionType: ActionConfig['type']) => {
      const actionConfig = ACTION_TYPE_CONFIG[actionType];
      const newNodeId = `action-${nodes.length}`;

      // Find the last node's position
      const lastNode = nodes[nodes.length - 1];
      const yPosition = lastNode ? lastNode.position.y + 200 : 250;

      const newNode: Node<NodeData> = {
        id: newNodeId,
        type: 'action',
        position: { x: 400, y: yPosition },
        data: {
          type: 'action',
          label: actionConfig.label,
          description: actionConfig.description,
          config: {
            type: actionType,
            config: DEFAULT_ACTION_CONFIGS[actionType],
          } as ActionConfig,
          onEdit: () => handleEditNode(newNodeId),
          onDelete: () => handleDeleteNode(newNodeId),
          onDuplicate: () => handleDuplicateNode(newNodeId),
        },
      };

      const newNodes = [...nodes, newNode];

      // Connect to the last node
      const sourceId = lastNode ? lastNode.id : 'trigger';
      const newEdge: Edge = {
        id: `${sourceId}-${newNodeId}`,
        source: sourceId,
        target: newNodeId,
        type: 'smoothstep',
        animated: true,
        markerEnd: {
          type: MarkerType.ArrowClosed,
        },
      };

      const newEdges = [...edges, newEdge];

      setNodes(newNodes);
      setEdges(newEdges);
      saveToHistory(newNodes, newEdges);
      setShowAddActionDialog(false);
    },
    [nodes, edges, setNodes, setEdges, saveToHistory],
  );

  // Edit node
  const handleEditNode = useCallback(
    (nodeId: string) => {
      const node = nodes.find(n => n.id === nodeId);
      if (node) {
        setSelectedNode(node);
        setEditingConfig(node.data.config);
        setShowEditDialog(true);
      }
    },
    [nodes],
  );

  // Save node edit
  const handleSaveEdit = useCallback(() => {
    if (!selectedNode || !editingConfig) {
      return;
    }

    const newNodes = nodes.map(node => {
      if (node.id === selectedNode.id) {
        const config =
          node.data.type === 'trigger'
            ? TRIGGER_TYPE_CONFIG[
                (editingConfig as TriggerConfig).type
              ]
            : ACTION_TYPE_CONFIG[(editingConfig as ActionConfig).type];

        return {
          ...node,
          data: {
            ...node.data,
            label: config.label,
            description: config.description,
            config: editingConfig,
          },
        };
      }
      return node;
    });

    setNodes(newNodes);
    saveToHistory(newNodes, edges);
    setShowEditDialog(false);
    setSelectedNode(null);
    setEditingConfig(null);
  }, [selectedNode, editingConfig, nodes, edges, setNodes, saveToHistory]);

  // Delete node
  const handleDeleteNode = useCallback(
    (nodeId: string) => {
      const newNodes = nodes.filter(n => n.id !== nodeId);
      const newEdges = edges.filter(
        e => e.source !== nodeId && e.target !== nodeId,
      );

      // Reconnect edges if deleting a middle node
      const incomingEdge = edges.find(e => e.target === nodeId);
      const outgoingEdge = edges.find(e => e.source === nodeId);

      if (incomingEdge && outgoingEdge) {
        newEdges.push({
          id: `${incomingEdge.source}-${outgoingEdge.target}`,
          source: incomingEdge.source,
          target: outgoingEdge.target,
          type: 'smoothstep',
          animated: true,
          markerEnd: {
            type: MarkerType.ArrowClosed,
          },
        });
      }

      setNodes(newNodes);
      setEdges(newEdges);
      saveToHistory(newNodes, newEdges);
    },
    [nodes, edges, setNodes, setEdges, saveToHistory],
  );

  // Duplicate node
  const handleDuplicateNode = useCallback(
    (nodeId: string) => {
      const node = nodes.find(n => n.id === nodeId);
      if (!node || node.data.type !== 'action') {
        return;
      }

      const newNodeId = `action-${Date.now()}`;
      const newNode: Node<NodeData> = {
        ...node,
        id: newNodeId,
        position: {
          x: node.position.x + 50,
          y: node.position.y + 100,
        },
        data: {
          ...node.data,
          onEdit: () => handleEditNode(newNodeId),
          onDelete: () => handleDeleteNode(newNodeId),
          onDuplicate: () => handleDuplicateNode(newNodeId),
        },
      };

      const newNodes = [...nodes, newNode];
      setNodes(newNodes);
      saveToHistory(newNodes, edges);
    },
    [nodes, edges, setNodes, saveToHistory],
  );

  // Save workflow
  const handleSaveWorkflow = useCallback(async () => {
    if (!name.trim()) {
      return;
    }

    const triggerNode = nodes.find(n => n.data.type === 'trigger');
    if (!triggerNode) {
      return;
    }

    const actionNodes = nodes.filter(n => n.data.type === 'action');

    const workflowInput: CreateWorkflowInput = {
      name: name.trim(),
      description: description.trim() || undefined,
      trigger: triggerNode.data.config as TriggerConfig,
      actions: actionNodes.map((node, index) => ({
        ...(node.data.config as ActionConfig),
        order: index,
      })),
    };

    await onSave(workflowInput);
  }, [name, description, nodes, onSave]);

  // Validation
  const isValid = useMemo(() => {
    const hasTrigger = nodes.some(n => n.data.type === 'trigger');
    const hasActions = nodes.some(n => n.data.type === 'action');
    return name.trim() !== '' && hasTrigger && hasActions;
  }, [name, nodes]);

  return (
    <div className={cn('flex h-full flex-col', className)}>
      {/* Header */}
      <div className='flex items-center justify-between border-b bg-background px-6 py-4'>
        <div className='flex-1'>
          <Input
            type='text'
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder='Workflow Name'
            className='max-w-md text-xl font-semibold'
          />
          <Textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder='Add description...'
            className='mt-2 max-w-md resize-none'
            rows={1}
          />
        </div>
        <div className='flex items-center gap-2'>
          <Button
            type='button'
            variant='outline'
            size='icon'
            onClick={handleUndo}
            disabled={historyIndex <= 0}
          >
            <Undo className='h-4 w-4' />
          </Button>
          <Button
            type='button'
            variant='outline'
            size='icon'
            onClick={handleRedo}
            disabled={historyIndex >= history.length - 1}
          >
            <Redo className='h-4 w-4' />
          </Button>
          <Button type='button' variant='outline' onClick={onCancel} disabled={isLoading}>
            Cancel
          </Button>
          <Button
            type='button'
            onClick={handleSaveWorkflow}
            disabled={isLoading || !isValid}
          >
            <Save className='mr-2 h-4 w-4' />
            Save Workflow
          </Button>
        </div>
      </div>

      {/* Canvas */}
      <div className='relative flex-1'>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          nodeTypes={nodeTypes}
          fitView
          className='bg-muted/30'
        >
          <Background />
          <Controls />
          <MiniMap
            nodeStrokeWidth={3}
            zoomable
            pannable
            className='border border-border'
          />

          {/* Floating Action Button */}
          <Panel position='bottom-right' className='mb-4 mr-4'>
            <Button
              type='button'
              size='lg'
              className='h-14 w-14 rounded-full shadow-lg'
              onClick={() => setShowAddActionDialog(true)}
            >
              <Plus className='h-6 w-6' />
            </Button>
          </Panel>
        </ReactFlow>
      </div>

      {/* Add Action Dialog */}
      <Dialog open={showAddActionDialog} onOpenChange={setShowAddActionDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Action</DialogTitle>
            <DialogDescription>
              Choose an action to add to your workflow
            </DialogDescription>
          </DialogHeader>
          <div className='grid gap-3 py-4'>
            {Object.entries(ACTION_TYPE_CONFIG).map(([type, config]) => (
              <button
                key={type}
                type='button'
                onClick={() =>
                  handleAddAction(type as ActionConfig['type'])
                }
                className='flex items-start gap-3 rounded-lg border border-border p-4 text-left transition-colors hover:border-primary hover:bg-primary/5'
              >
                <div className='rounded-md bg-blue-500 p-2 text-white'>
                  <Play className='h-5 w-5' />
                </div>
                <div>
                  <h3 className='font-semibold'>{config.label}</h3>
                  <p className='text-sm text-muted-foreground'>
                    {config.description}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Node Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Edit {selectedNode?.data.type === 'trigger' ? 'Trigger' : 'Action'}
            </DialogTitle>
            <DialogDescription>
              Configure the {selectedNode?.data.type} settings
            </DialogDescription>
          </DialogHeader>
          <div className='space-y-4 py-4'>
            {editingConfig && selectedNode?.data.type === 'trigger' && (
              <div className='space-y-2'>
                <Label>Trigger Type</Label>
                <Select
                  value={(editingConfig as TriggerConfig).type}
                  onValueChange={value =>
                    setEditingConfig({
                      type: value as TriggerConfig['type'],
                      [value]: {},
                    } as TriggerConfig)
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(TRIGGER_TYPE_CONFIG).map(([key, config]) => (
                      <SelectItem key={key} value={key}>
                        {config.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {editingConfig && selectedNode?.data.type === 'action' && (
              <div className='space-y-2'>
                <Label>Action Type</Label>
                <Select
                  value={(editingConfig as ActionConfig).type}
                  onValueChange={value =>
                    setEditingConfig({
                      type: value as ActionConfig['type'],
                      config: DEFAULT_ACTION_CONFIGS[value as ActionConfig['type']],
                    } as ActionConfig)
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(ACTION_TYPE_CONFIG).map(([key, config]) => (
                      <SelectItem key={key} value={key}>
                        {config.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              type='button'
              variant='outline'
              onClick={() => setShowEditDialog(false)}
            >
              Cancel
            </Button>
            <Button type='button' onClick={handleSaveEdit}>
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
