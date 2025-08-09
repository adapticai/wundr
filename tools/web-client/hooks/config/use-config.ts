import { useConfig as useConfigContext } from '@/lib/contexts/config/config-context';
import { useCallback, useMemo } from 'react';
import { Config } from '@/lib/contexts/config/config-context';

export function useConfig() {
  return useConfigContext();
}

export function useConfigSection<T extends keyof Config>(section: T) {
  const { config, updateConfig, resetSection, errors } = useConfig();
  
  const sectionConfig = config[section];
  
  const updateSection = useCallback(
    (updates: Partial<Config[T]>) => {
      updateConfig(updates);
    },
    [updateConfig, section]
  );
  
  const resetSectionCallback = useCallback(() => {
    resetSection(section);
  }, [resetSection, section]);
  
  const sectionErrors = useMemo(() => {
    const sectionErrorMap: Record<string, string> = {};
    Object.entries(errors).forEach(([key, value]) => {
      if (key.startsWith(`${section}.`)) {
        const fieldKey = key.replace(`${section}.`, '');
        sectionErrorMap[fieldKey] = value;
      }
    });
    return sectionErrorMap;
  }, [errors, section]);
  
  return {
    config: sectionConfig,
    updateConfig: updateSection,
    resetSection: resetSectionCallback,
    errors: sectionErrors,
    hasErrors: Object.keys(sectionErrors).length > 0,
  };
}

export function useConfigValidation() {
  const { errors } = useConfig();
  
  const hasErrors = useMemo(() => Object.keys(errors).length > 0, [errors]);
  
  const getFieldError = useCallback(
    (section: keyof Config, field: string) => {
      return errors[`${section}.${field}`];
    },
    [errors]
  );
  
  const getSectionErrors = useCallback(
    (section: keyof Config) => {
      const sectionErrors: Record<string, string> = {};
      Object.entries(errors).forEach(([key, value]) => {
        if (key.startsWith(`${section}.`)) {
          const fieldKey = key.replace(`${section}.`, '');
          sectionErrors[fieldKey] = value;
        }
      });
      return sectionErrors;
    },
    [errors]
  );
  
  return {
    errors,
    hasErrors,
    getFieldError,
    getSectionErrors,
  };
}

export function useConfigPersistence() {
  const { exportConfig, importConfig, save, isDirty } = useConfig();
  
  return {
    exportConfig,
    importConfig,
    save,
    isDirty,
  };
}

export function useConfigTemplates() {
  const { applyTemplate } = useConfig();
  
  return {
    applyTemplate,
  };
}