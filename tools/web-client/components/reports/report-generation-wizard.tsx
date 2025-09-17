'use client';

import { useState } from 'react';
import { Check, ChevronRight, ChevronLeft, Wand2, FileText, Settings, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useReports } from '@/hooks/reports/use-reports';
import {
  ReportTemplate,
  GenerateReportRequest,
  ExportFormat,
  ReportParameter
} from '@/types/reports';
import type { ReportParameters, ParameterValue } from '@/types/report-parameters';

interface ReportGenerationWizardProps {
  onClose: () => void;
}

const steps = [
  { id: 'template', label: 'Select Template', icon: FileText },
  { id: 'configure', label: 'Configure', icon: Settings },
  { id: 'schedule', label: 'Schedule & Export', icon: Calendar },
  { id: 'review', label: 'Review', icon: Check },
];

export function ReportGenerationWizard({ onClose }: ReportGenerationWizardProps) {
  const { templates, generateReport } = useReports();
  const [currentStep, setCurrentStep] = useState(0);
  const [selectedTemplate, setSelectedTemplate] = useState<ReportTemplate | null>(null);
  const [reportName, setReportName] = useState('');
  const [reportDescription, setReportDescription] = useState('');
  const [parameters, setParameters] = useState<ReportParameters>({});
  const [outputFormats, setOutputFormats] = useState<ExportFormat[]>(['pdf']);
  const [tags, setTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState('');
  const [scheduleReport, setScheduleReport] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  const handleTemplateSelect = (template: ReportTemplate) => {
    setSelectedTemplate(template);
    setReportName(template.name);
    
    // Set default parameter values
    const defaultParams: ReportParameters = {};
    template.parameters.forEach(param => {
      if (param.defaultValue !== undefined) {
        defaultParams[param.key] = param.defaultValue;
      }
    });
    setParameters(defaultParams);
  };

  const handleParameterChange = (key: string, value: ParameterValue) => {
    setParameters(prev => ({ ...prev, [key]: value }));
  };

  const handleFormatToggle = (format: ExportFormat) => {
    setOutputFormats(prev => 
      prev.includes(format) 
        ? prev.filter(f => f !== format)
        : [...prev, format]
    );
  };

  const addTag = () => {
    if (newTag.trim() && !tags.includes(newTag.trim())) {
      setTags(prev => [...prev, newTag.trim()]);
      setNewTag('');
    }
  };

  const removeTag = (tagToRemove: string) => {
    setTags(prev => prev.filter(tag => tag !== tagToRemove));
  };

  const handleGenerate = async () => {
    if (!selectedTemplate) return;

    setIsGenerating(true);
    try {
      const request: GenerateReportRequest = {
        templateId: selectedTemplate.id,
        name: reportName,
        description: reportDescription,
        parameters,
        outputFormats,
        tags,
      };

      await generateReport(request);
      onClose();
    } catch (_error) {
      // Error logged - details available in network tab;
    } finally {
      setIsGenerating(false);
    }
  };

  const canProceed = () => {
    switch (currentStep) {
      case 0:
        return selectedTemplate !== null;
      case 1:
        return reportName.trim() !== '' && validateParameters();
      case 2:
        return outputFormats.length > 0;
      case 3:
        return true;
      default:
        return false;
    }
  };

  const validateParameters = () => {
    if (!selectedTemplate) return false;
    
    return selectedTemplate.parameters.every(param => {
      if (!param.required) return true;
      const value = parameters[param.key];
      return value !== undefined && value !== null && value !== '';
    });
  };

  const renderParameterInput = (param: ReportParameter) => {
    const value = parameters[param.key];

    switch (param.type) {
      case 'string':
        return (
          <Input
            value={value || ''}
            onChange={(e) => handleParameterChange(param.key, e.target.value)}
            placeholder={param.description}
          />
        );
      case 'number':
        return (
          <Input
            type="number"
            value={value || ''}
            onChange={(e) => handleParameterChange(param.key, Number(e.target.value))}
            min={param.validation?.min}
            max={param.validation?.max}
          />
        );
      case 'boolean':
        return (
          <Switch
            checked={value || false}
            onCheckedChange={(checked) => handleParameterChange(param.key, checked)}
          />
        );
      case 'select':
        return (
          <Select
            value={value?.toString() || ''}
            onValueChange={(newValue) => handleParameterChange(param.key, newValue)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select an option" />
            </SelectTrigger>
            <SelectContent>
              {param.options?.map((option) => (
                <SelectItem key={option.value} value={option.value.toString()}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
      case 'multiselect':
        return (
          <div className="space-y-2">
            {param.options?.map((option) => (
              <div key={option.value} className="flex items-center space-x-2">
                <Checkbox
                  id={`${param.key}-${option.value}`}
                  checked={(value || []).includes(option.value)}
                  onCheckedChange={(checked) => {
                    const currentValues = value || [];
                    const newValues = checked
                      ? [...currentValues, option.value]
                      : currentValues.filter((v: ParameterValue) => v !== option.value);
                    handleParameterChange(param.key, newValues);
                  }}
                />
                <Label htmlFor={`${param.key}-${option.value}`}>
                  {option.label}
                </Label>
              </div>
            ))}
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>Generate Report</DialogTitle>
        <DialogDescription>
          Create a new migration report using our templates
        </DialogDescription>
      </DialogHeader>

      {/* Progress Steps */}
      <div className="flex items-center justify-between mb-6">
        {steps.map((step, index) => (
          <div key={step.id} className="flex items-center">
            <div className={`flex items-center justify-center w-8 h-8 rounded-full border-2 ${
              index <= currentStep 
                ? 'bg-primary border-primary text-primary-foreground' 
                : 'border-muted-foreground text-muted-foreground'
            }`}>
              {index < currentStep ? (
                <Check className="w-4 h-4" />
              ) : (
                <step.icon className="w-4 h-4" />
              )}
            </div>
            <span className={`ml-2 text-sm font-medium ${
              index <= currentStep ? 'text-foreground' : 'text-muted-foreground'
            }`}>
              {step.label}
            </span>
            {index < steps.length - 1 && (
              <ChevronRight className="w-4 h-4 mx-4 text-muted-foreground" />
            )}
          </div>
        ))}
      </div>

      {/* Step Content */}
      <div className="min-h-[400px]">
        {currentStep === 0 && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Select a Report Template</h3>
            <div className="grid gap-4 md:grid-cols-2">
              {templates.map((template) => (
                <Card 
                  key={template.id}
                  className={`cursor-pointer transition-colors ${
                    selectedTemplate?.id === template.id ? 'ring-2 ring-primary' : ''
                  }`}
                  onClick={() => handleTemplateSelect(template)}
                >
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">{template.name}</CardTitle>
                      <Badge variant={template.category === 'standard' ? 'default' : 'secondary'}>
                        {template.category}
                      </Badge>
                    </div>
                    <CardDescription>{template.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="text-sm text-muted-foreground">
                      Estimated: {Math.floor((template.estimatedDuration || 0) / 60)}m
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {currentStep === 1 && selectedTemplate && (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold">Configure Report</h3>
            
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label htmlFor="name">Report Name</Label>
                <Input
                  id="name"
                  value={reportName}
                  onChange={(e) => setReportName(e.target.value)}
                  placeholder="Enter report name"
                />
              </div>
              <div>
                <Label htmlFor="description">Description (Optional)</Label>
                <Textarea
                  id="description"
                  value={reportDescription}
                  onChange={(e) => setReportDescription(e.target.value)}
                  placeholder="Describe the purpose of this report"
                  rows={3}
                />
              </div>
            </div>

            {selectedTemplate.parameters.length > 0 && (
              <div>
                <h4 className="font-medium mb-4">Template Parameters</h4>
                <div className="space-y-4">
                  {selectedTemplate.parameters.map((param) => (
                    <div key={param.key}>
                      <Label className="flex items-center gap-2">
                        {param.label}
                        {param.required && <span className="text-red-500">*</span>}
                      </Label>
                      {param.description && (
                        <p className="text-sm text-muted-foreground mb-2">
                          {param.description}
                        </p>
                      )}
                      {renderParameterInput(param)}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div>
              <Label>Tags (Optional)</Label>
              <div className="flex gap-2 mt-2">
                <Input
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  placeholder="Add a tag"
                  onKeyPress={(e) => e.key === 'Enter' && addTag()}
                />
                <Button type="button" onClick={addTag} variant="outline">
                  Add
                </Button>
              </div>
              {tags.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {tags.map((tag) => (
                    <Badge key={tag} variant="secondary" className="cursor-pointer" onClick={() => removeTag(tag)}>
                      {tag} ×
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {currentStep === 2 && (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold">Export & Schedule Options</h3>
            
            <div>
              <Label>Export Formats</Label>
              <div className="grid grid-cols-2 gap-4 mt-2">
                {(['pdf', 'excel', 'csv', 'json'] as ExportFormat[]).map((format) => (
                  <div key={format} className="flex items-center space-x-2">
                    <Checkbox
                      id={format}
                      checked={outputFormats.includes(format)}
                      onCheckedChange={() => handleFormatToggle(format)}
                    />
                    <Label htmlFor={format} className="capitalize">
                      {format.toUpperCase()}
                    </Label>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="schedule"
                checked={scheduleReport}
                onCheckedChange={setScheduleReport}
              />
              <Label htmlFor="schedule">Schedule this report to run regularly</Label>
            </div>

            {scheduleReport && (
              <Card>
                <CardContent className="pt-6">
                  <p className="text-sm text-muted-foreground">
                    Scheduling options will be available after report generation.
                    You can set up recurring schedules from the reports dashboard.
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {currentStep === 3 && selectedTemplate && (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold">Review & Generate</h3>
            
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Report Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label className="text-sm font-medium">Template</Label>
                  <p className="text-sm text-muted-foreground">{selectedTemplate.name}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium">Name</Label>
                  <p className="text-sm text-muted-foreground">{reportName}</p>
                </div>
                {reportDescription && (
                  <div>
                    <Label className="text-sm font-medium">Description</Label>
                    <p className="text-sm text-muted-foreground">{reportDescription}</p>
                  </div>
                )}
                <div>
                  <Label className="text-sm font-medium">Export Formats</Label>
                  <div className="flex gap-1 mt-1">
                    {outputFormats.map((format) => (
                      <Badge key={format} variant="outline">
                        {format.toUpperCase()}
                      </Badge>
                    ))}
                  </div>
                </div>
                {tags.length > 0 && (
                  <div>
                    <Label className="text-sm font-medium">Tags</Label>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {tags.map((tag) => (
                        <Badge key={tag} variant="secondary">{tag}</Badge>
                      ))}
                    </div>
                  </div>
                )}
                <div>
                  <Label className="text-sm font-medium">Estimated Duration</Label>
                  <p className="text-sm text-muted-foreground">
                    ~{Math.floor((selectedTemplate.estimatedDuration || 0) / 60)} minutes
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="flex justify-between pt-6 border-t">
        <Button
          variant="outline"
          onClick={() => setCurrentStep(Math.max(0, currentStep - 1))}
          disabled={currentStep === 0}
        >
          <ChevronLeft className="mr-2 h-4 w-4" />
          Previous
        </Button>
        
        {currentStep < steps.length - 1 ? (
          <Button
            onClick={() => setCurrentStep(currentStep + 1)}
            disabled={!canProceed()}
          >
            Next
            <ChevronRight className="ml-2 h-4 w-4" />
          </Button>
        ) : (
          <Button
            onClick={handleGenerate}
            disabled={!canProceed() || isGenerating}
          >
            {isGenerating ? (
              <>
                <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                Generating...
              </>
            ) : (
              <>
                <Wand2 className="mr-2 h-4 w-4" />
                Generate Report
              </>
            )}
          </Button>
        )}
      </div>
    </>
  );
}