'use client';
'use strict';
var __awaiter =
  (this && this.__awaiter) ||
  function (thisArg, _arguments, P, generator) {
    function adopt(value) {
      return value instanceof P
        ? value
        : new P(function (resolve) {
            resolve(value);
          });
    }
    return new (P || (P = Promise))(function (resolve, reject) {
      function fulfilled(value) {
        try {
          step(generator.next(value));
        } catch (e) {
          reject(e);
        }
      }
      function rejected(value) {
        try {
          step(generator['throw'](value));
        } catch (e) {
          reject(e);
        }
      }
      function step(result) {
        result.done
          ? resolve(result.value)
          : adopt(result.value).then(fulfilled, rejected);
      }
      step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
  };
var __generator =
  (this && this.__generator) ||
  function (thisArg, body) {
    var _ = {
        label: 0,
        sent: function () {
          if (t[0] & 1) throw t[1];
          return t[1];
        },
        trys: [],
        ops: [],
      },
      f,
      y,
      t,
      g = Object.create(
        (typeof Iterator === 'function' ? Iterator : Object).prototype
      );
    return (
      (g.next = verb(0)),
      (g['throw'] = verb(1)),
      (g['return'] = verb(2)),
      typeof Symbol === 'function' &&
        (g[Symbol.iterator] = function () {
          return this;
        }),
      g
    );
    function verb(n) {
      return function (v) {
        return step([n, v]);
      };
    }
    function step(op) {
      if (f) throw new TypeError('Generator is already executing.');
      while ((g && ((g = 0), op[0] && (_ = 0)), _))
        try {
          if (
            ((f = 1),
            y &&
              (t =
                op[0] & 2
                  ? y['return']
                  : op[0]
                    ? y['throw'] || ((t = y['return']) && t.call(y), 0)
                    : y.next) &&
              !(t = t.call(y, op[1])).done)
          )
            return t;
          if (((y = 0), t)) op = [op[0] & 2, t.value];
          switch (op[0]) {
            case 0:
            case 1:
              t = op;
              break;
            case 4:
              _.label++;
              return { value: op[1], done: false };
            case 5:
              _.label++;
              y = op[1];
              op = [0];
              continue;
            case 7:
              op = _.ops.pop();
              _.trys.pop();
              continue;
            default:
              if (
                !((t = _.trys), (t = t.length > 0 && t[t.length - 1])) &&
                (op[0] === 6 || op[0] === 2)
              ) {
                _ = 0;
                continue;
              }
              if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) {
                _.label = op[1];
                break;
              }
              if (op[0] === 6 && _.label < t[1]) {
                _.label = t[1];
                t = op;
                break;
              }
              if (t && _.label < t[2]) {
                _.label = t[2];
                _.ops.push(op);
                break;
              }
              if (t[2]) _.ops.pop();
              _.trys.pop();
              continue;
          }
          op = body.call(thisArg, _);
        } catch (e) {
          op = [6, e];
          y = 0;
        } finally {
          f = t = 0;
        }
      if (op[0] & 5) throw op[1];
      return { value: op[0] ? op[1] : void 0, done: true };
    }
  };
Object.defineProperty(exports, '__esModule', { value: true });
exports.ToolResult = ToolResult;
/**
 * Tool Result Display Component
 *
 * Renders tool execution results with type-specific formatting and visualization.
 */
var React = require('react');
var lucide_react_1 = require('lucide-react');
var badge_1 = require('@/components/ui/badge');
var button_1 = require('@/components/ui/button');
var collapsible_1 = require('@/components/ui/collapsible');
/**
 * Main tool result component
 */
function ToolResult(_a) {
  var _this = this;
  var toolName = _a.toolName,
    category = _a.category,
    success = _a.success,
    data = _a.data,
    error = _a.error,
    metadata = _a.metadata,
    _b = _a.defaultExpanded,
    defaultExpanded = _b === void 0 ? true : _b,
    onApprove = _a.onApprove,
    onReject = _a.onReject;
  var _c = React.useState(defaultExpanded),
    isExpanded = _c[0],
    setIsExpanded = _c[1];
  var _d = React.useState(false),
    copied = _d[0],
    setCopied = _d[1];
  var handleCopy = function () {
    return __awaiter(_this, void 0, void 0, function () {
      var content;
      return __generator(this, function (_a) {
        switch (_a.label) {
          case 0:
            content = JSON.stringify(data, null, 2);
            return [4 /*yield*/, navigator.clipboard.writeText(content)];
          case 1:
            _a.sent();
            setCopied(true);
            setTimeout(function () {
              return setCopied(false);
            }, 2000);
            return [2 /*return*/];
        }
      });
    });
  };
  var handleApprove = function () {
    if (
      (metadata === null || metadata === void 0
        ? void 0
        : metadata.approvalId) &&
      onApprove
    ) {
      onApprove(metadata.approvalId);
    }
  };
  var handleReject = function () {
    if (
      (metadata === null || metadata === void 0
        ? void 0
        : metadata.approvalId) &&
      onReject
    ) {
      onReject(metadata.approvalId);
    }
  };
  return (
    <div className='rounded-lg border bg-card'>
      {/* Header */}
      <collapsible_1.Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
        <div className='flex items-center justify-between p-3 border-b'>
          <div className='flex items-center gap-2 flex-1'>
            <CategoryIcon category={category} />
            <span className='font-medium text-sm'>
              {formatToolName(toolName)}
            </span>
            <StatusBadge success={success} error={error} metadata={metadata} />
          </div>
          <div className='flex items-center gap-2'>
            {(metadata === null || metadata === void 0
              ? void 0
              : metadata.executionTime) && (
              <badge_1.Badge variant='outline' className='text-xs gap-1'>
                <lucide_react_1.Clock className='h-3 w-3' />
                {metadata.executionTime}ms
              </badge_1.Badge>
            )}
            {(metadata === null || metadata === void 0
              ? void 0
              : metadata.cached) && (
              <badge_1.Badge variant='secondary' className='text-xs'>
                Cached
              </badge_1.Badge>
            )}
            <collapsible_1.CollapsibleTrigger asChild>
              <button_1.Button
                variant='ghost'
                size='sm'
                className='h-6 w-6 p-0'
              >
                {isExpanded ? (
                  <lucide_react_1.ChevronDown className='h-4 w-4' />
                ) : (
                  <lucide_react_1.ChevronRight className='h-4 w-4' />
                )}
              </button_1.Button>
            </collapsible_1.CollapsibleTrigger>
          </div>
        </div>

        {/* Content */}
        <collapsible_1.CollapsibleContent>
          <div className='p-3 space-y-3'>
            {/* Approval Required */}
            {(metadata === null || metadata === void 0
              ? void 0
              : metadata.requiresApproval) &&
              metadata.approvalId && (
                <div className='rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 p-3'>
                  <div className='flex items-center gap-2 mb-2'>
                    <lucide_react_1.AlertCircle className='h-4 w-4 text-amber-600 dark:text-amber-400' />
                    <span className='font-medium text-sm text-amber-900 dark:text-amber-100'>
                      Approval Required
                    </span>
                  </div>
                  <p className='text-xs text-amber-700 dark:text-amber-300 mb-3'>
                    This tool requires approval before execution. Please review
                    the operation and approve or reject.
                  </p>
                  <div className='flex gap-2'>
                    <button_1.Button
                      size='sm'
                      variant='default'
                      onClick={handleApprove}
                      className='bg-amber-600 hover:bg-amber-700'
                    >
                      Approve & Execute
                    </button_1.Button>
                    <button_1.Button
                      size='sm'
                      variant='outline'
                      onClick={handleReject}
                    >
                      Reject
                    </button_1.Button>
                  </div>
                </div>
              )}

            {/* Error Display */}
            {!success && error && (
              <div className='rounded-lg bg-destructive/10 border border-destructive/20 p-3'>
                <div className='flex items-center gap-2 mb-1'>
                  <lucide_react_1.XCircle className='h-4 w-4 text-destructive' />
                  <span className='font-medium text-sm text-destructive'>
                    Error
                  </span>
                </div>
                <p className='text-xs text-destructive/90'>{error}</p>
              </div>
            )}

            {/* Success Data Display */}
            {success && data && (
              <div className='space-y-2'>
                <div className='flex items-center justify-between'>
                  <span className='text-xs font-medium text-muted-foreground'>
                    Result
                  </span>
                  <button_1.Button
                    variant='ghost'
                    size='sm'
                    className='h-6 px-2 text-xs'
                    onClick={handleCopy}
                  >
                    {copied ? (
                      <>
                        <lucide_react_1.Check className='h-3 w-3 mr-1' />
                        Copied
                      </>
                    ) : (
                      <>
                        <lucide_react_1.Copy className='h-3 w-3 mr-1' />
                        Copy
                      </>
                    )}
                  </button_1.Button>
                </div>
                <ResultRenderer category={category} data={data} />
              </div>
            )}
          </div>
        </collapsible_1.CollapsibleContent>
      </collapsible_1.Collapsible>
    </div>
  );
}
/**
 * Category icon selector
 */
function CategoryIcon(_a) {
  var category = _a.category;
  var icons = {
    workflow: lucide_react_1.BarChart3,
    search: lucide_react_1.Search,
    data: lucide_react_1.Database,
    system: lucide_react_1.FileText,
    integration: lucide_react_1.ExternalLink,
  };
  var Icon = icons[category];
  return <Icon className='h-4 w-4 text-muted-foreground' />;
}
/**
 * Status badge
 */
function StatusBadge(_a) {
  var success = _a.success,
    error = _a.error,
    metadata = _a.metadata;
  if (
    metadata === null || metadata === void 0
      ? void 0
      : metadata.requiresApproval
  ) {
    return (
      <badge_1.Badge variant='secondary' className='gap-1'>
        <lucide_react_1.AlertCircle className='h-3 w-3' />
        Pending Approval
      </badge_1.Badge>
    );
  }
  if (success) {
    return (
      <badge_1.Badge
        variant='outline'
        className='gap-1 border-green-200 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-950/20 dark:text-green-400'
      >
        <lucide_react_1.CheckCircle2 className='h-3 w-3' />
        Success
      </badge_1.Badge>
    );
  }
  return (
    <badge_1.Badge variant='destructive' className='gap-1'>
      <lucide_react_1.XCircle className='h-3 w-3' />
      Failed
    </badge_1.Badge>
  );
}
/**
 * Result renderer with category-specific formatting
 */
function ResultRenderer(_a) {
  var category = _a.category,
    data = _a.data;
  // Workflow results
  if (category === 'workflow') {
    return <WorkflowResult data={data} />;
  }
  // Search results
  if (category === 'search') {
    return <SearchResult data={data} />;
  }
  // Data/Analytics results
  if (category === 'data') {
    return <DataResult data={data} />;
  }
  // Default JSON display
  return <JsonResult data={data} />;
}
/**
 * Workflow-specific result display
 */
function WorkflowResult(_a) {
  var data = _a.data;
  var workflowData = data;
  return (
    <div className='space-y-2'>
      {workflowData.workflowId && (
        <ResultField
          label='Workflow ID'
          value={workflowData.workflowId}
          copyable
        />
      )}
      {workflowData.executionId && (
        <ResultField
          label='Execution ID'
          value={workflowData.executionId}
          copyable
        />
      )}
      {workflowData.status && (
        <ResultField
          label='Status'
          value={
            <badge_1.Badge
              variant={
                workflowData.status === 'completed' ? 'default' : 'secondary'
              }
            >
              {workflowData.status}
            </badge_1.Badge>
          }
        />
      )}
      {workflowData.stats && (
        <div className='space-y-1'>
          <div className='text-xs font-medium text-muted-foreground'>
            Statistics
          </div>
          <div className='grid grid-cols-2 gap-2 text-xs'>
            {Object.entries(workflowData.stats).map(function (_a) {
              var key = _a[0],
                value = _a[1];
              return (
                <div
                  key={key}
                  className='flex justify-between p-2 rounded bg-muted/50'
                >
                  <span className='text-muted-foreground'>
                    {formatFieldName(key)}
                  </span>
                  <span className='font-medium'>{value}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
      {workflowData.result && (
        <JsonResult data={workflowData.result} label='Execution Result' />
      )}
    </div>
  );
}
/**
 * Search-specific result display
 */
function SearchResult(_a) {
  var data = _a.data;
  var searchData = data;
  var results = Array.isArray(searchData) ? searchData : searchData.data || [];
  if (results.length === 0) {
    return (
      <div className='text-xs text-muted-foreground text-center py-4'>
        No results found
      </div>
    );
  }
  return (
    <div className='space-y-2'>
      <div className='text-xs text-muted-foreground'>
        Found {results.length} result{results.length !== 1 ? 's' : ''}
      </div>
      <div className='space-y-2 max-h-64 overflow-y-auto'>
        {results.slice(0, 10).map(function (item, index) {
          return (
            <div
              key={index}
              className='p-2 rounded border bg-muted/30 text-xs space-y-1'
            >
              {Object.entries(item).map(function (_a) {
                var key = _a[0],
                  value = _a[1];
                return (
                  <div key={key} className='flex gap-2'>
                    <span className='font-medium text-muted-foreground min-w-20'>
                      {formatFieldName(key)}:
                    </span>
                    <span className='break-all'>
                      {String(formatValue(value))}
                    </span>
                  </div>
                );
              })}
            </div>
          );
        })}
        {results.length > 10 && (
          <div className='text-xs text-muted-foreground text-center py-2'>
            And {results.length - 10} more...
          </div>
        )}
      </div>
    </div>
  );
}
/**
 * Data/Analytics result display
 */
function DataResult(_a) {
  var data = _a.data;
  var dataResult = data;
  return (
    <div className='space-y-3'>
      {dataResult.count !== undefined && (
        <ResultField
          label='Total Records'
          value={dataResult.count.toLocaleString()}
        />
      )}

      {dataResult.aggregations && (
        <div className='space-y-1'>
          <div className='text-xs font-medium text-muted-foreground'>
            Aggregations
          </div>
          <div className='grid grid-cols-2 gap-2'>
            {Object.entries(dataResult.aggregations).map(function (_a) {
              var key = _a[0],
                value = _a[1];
              return (
                <div
                  key={key}
                  className='flex flex-col p-2 rounded bg-muted/50'
                >
                  <span className='text-xs text-muted-foreground'>
                    {formatFieldName(key)}
                  </span>
                  <span className='text-sm font-medium'>
                    {String(formatValue(value))}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {dataResult.summary && (
        <JsonResult data={dataResult.summary} label='Summary' />
      )}

      {dataResult.downloadUrl && (
        <button_1.Button variant='outline' size='sm' asChild className='w-full'>
          <a
            href={dataResult.downloadUrl}
            target='_blank'
            rel='noopener noreferrer'
          >
            <lucide_react_1.Download className='h-4 w-4 mr-2' />
            Download Export
          </a>
        </button_1.Button>
      )}

      {dataResult.data &&
        Array.isArray(dataResult.data) &&
        dataResult.data.length > 0 && <SearchResult data={dataResult.data} />}
    </div>
  );
}
/**
 * Generic JSON result display
 */
function JsonResult(_a) {
  var data = _a.data,
    label = _a.label;
  return (
    <div className='space-y-1'>
      {label && (
        <div className='text-xs font-medium text-muted-foreground'>{label}</div>
      )}
      <pre className='text-xs bg-muted/50 p-2 rounded overflow-x-auto max-h-64 overflow-y-auto'>
        {JSON.stringify(data, null, 2)}
      </pre>
    </div>
  );
}
/**
 * Result field component
 */
function ResultField(_a) {
  var _this = this;
  var label = _a.label,
    value = _a.value,
    _b = _a.copyable,
    copyable = _b === void 0 ? false : _b;
  var _c = React.useState(false),
    copied = _c[0],
    setCopied = _c[1];
  var handleCopy = function () {
    return __awaiter(_this, void 0, void 0, function () {
      return __generator(this, function (_a) {
        switch (_a.label) {
          case 0:
            if (!(typeof value === 'string')) return [3 /*break*/, 2];
            return [4 /*yield*/, navigator.clipboard.writeText(value)];
          case 1:
            _a.sent();
            setCopied(true);
            setTimeout(function () {
              return setCopied(false);
            }, 2000);
            _a.label = 2;
          case 2:
            return [2 /*return*/];
        }
      });
    });
  };
  return (
    <div className='flex items-center justify-between p-2 rounded bg-muted/30'>
      <div className='flex flex-col gap-0.5'>
        <span className='text-xs text-muted-foreground'>{label}</span>
        <div className='text-sm font-medium'>{value}</div>
      </div>
      {copyable && (
        <button_1.Button
          variant='ghost'
          size='sm'
          className='h-6 w-6 p-0'
          onClick={handleCopy}
        >
          {copied ? (
            <lucide_react_1.Check className='h-3 w-3' />
          ) : (
            <lucide_react_1.Copy className='h-3 w-3' />
          )}
        </button_1.Button>
      )}
    </div>
  );
}
/**
 * Utility: Format tool name
 */
function formatToolName(name) {
  return name
    .split('_')
    .map(function (word) {
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(' ');
}
/**
 * Utility: Format field name
 */
function formatFieldName(name) {
  return name
    .replace(/([A-Z])/g, ' $1')
    .replace(/_/g, ' ')
    .replace(/^./, function (str) {
      return str.toUpperCase();
    })
    .trim();
}
/**
 * Utility: Format value for display
 */
function formatValue(value) {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  if (typeof value === 'boolean') return value.toString();
  if (typeof value === 'number') return value.toLocaleString();
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return '['.concat(value.length, ' items]');
  if (typeof value === 'object') return '{...}';
  return String(value);
}
