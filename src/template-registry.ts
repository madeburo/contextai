import { UnknownTemplateError } from './errors.js';
import type { ContextConfig, ConventionsConfig, TemplateName } from './types.js';

export interface Template {
  name: TemplateName;
  conventions: ConventionsConfig;
}

export interface TemplateRegistry {
  get(name: TemplateName): Template;
  merge(base: ContextConfig, templateNames: TemplateName[]): ContextConfig;
  list(): TemplateName[];
}

// Static imports of all built-in templates
import nextjsTemplate from './templates/nextjs.json';
import nestjsTemplate from './templates/nestjs.json';
import expressTemplate from './templates/express.json';
import remixTemplate from './templates/remix.json';
import sveltekitTemplate from './templates/sveltekit.json';

const BUILT_IN_TEMPLATES: Record<TemplateName, Template> = {
  nextjs: nextjsTemplate as Template,
  nestjs: nestjsTemplate as Template,
  express: expressTemplate as Template,
  remix: remixTemplate as Template,
  sveltekit: sveltekitTemplate as Template,
};

export class DefaultTemplateRegistry implements TemplateRegistry {
  get(name: TemplateName): Template {
    if (!Object.prototype.hasOwnProperty.call(BUILT_IN_TEMPLATES, name)) {
      throw new UnknownTemplateError(name);
    }
    return BUILT_IN_TEMPLATES[name]!;
  }

  merge(base: ContextConfig, templateNames: TemplateName[]): ContextConfig {
    // Validate all template names first before merging
    for (const name of templateNames) {
      this.get(name); // throws UnknownTemplateError if not found
    }

    const mergedConventions: ConventionsConfig = {};

    // Copy existing conventions (deep clone to avoid mutation)
    for (const [key, sections] of Object.entries(base.conventions)) {
      mergedConventions[key] = [...sections];
    }

    // Append template conventions without overwriting existing keys
    for (const name of templateNames) {
      const template = BUILT_IN_TEMPLATES[name]!;
      for (const [key, sections] of Object.entries(template.conventions)) {
        if (mergedConventions[key]) {
          // Append template sections to existing key
          mergedConventions[key] = [...mergedConventions[key]!, ...sections];
        } else {
          // New key from template
          mergedConventions[key] = [...sections];
        }
      }
    }

    return {
      ...base,
      conventions: mergedConventions,
    };
  }

  list(): TemplateName[] {
    return Object.keys(BUILT_IN_TEMPLATES) as TemplateName[];
  }
}
