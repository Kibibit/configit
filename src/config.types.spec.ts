import { EConfigSource, IConfigurationOptions } from './config.types';
import { IConfigVariableOptions } from './json-schema.validator';

describe('Configuration Types', () => {
  describe('EConfigSource enum', () => {
    test('should have env value', () => {
      expect(EConfigSource.env).toBe('env');
    });

    test('should have file value', () => {
      expect(EConfigSource.file).toBe('file');
    });

    test('should have both value', () => {
      expect(EConfigSource.both).toBe('both');
    });

    test('should have exactly 3 values', () => {
      const values = Object.values(EConfigSource);
      expect(values.length).toBe(3);
    });

    test('should support enum value access', () => {
      const envSource: EConfigSource = EConfigSource.env;
      const fileSource: EConfigSource = EConfigSource.file;
      const bothSource: EConfigSource = EConfigSource.both;
      
      expect(envSource).toBe('env');
      expect(fileSource).toBe('file');
      expect(bothSource).toBe('both');
    });
  });

  describe('IConfigVariableOptions interface', () => {
    test('should allow exclude property', () => {
      const options: IConfigVariableOptions = {
        exclude: true
      };
      expect(options.exclude).toBe(true);
    });

    test('should allow source property with enum', () => {
      const options: IConfigVariableOptions = {
        source: EConfigSource.env
      };
      expect(options.source).toBe('env');
    });

    test('should allow source property with string literal', () => {
      const options: IConfigVariableOptions = {
        source: 'file'
      };
      expect(options.source).toBe('file');
    });

    test('should allow both exclude and source properties', () => {
      const options: IConfigVariableOptions = {
        exclude: true,
        source: EConfigSource.both
      };
      expect(options.exclude).toBe(true);
      expect(options.source).toBe('both');
    });

    test('should allow empty options object', () => {
      const options: IConfigVariableOptions = {};
      expect(options).toBeDefined();
      expect(options.exclude).toBeUndefined();
      expect(options.source).toBeUndefined();
    });
  });

  describe('IConfigurationOptions interface', () => {
    test('should allow fileName property', () => {
      const options: IConfigurationOptions = {
        fileName: 'app-config'
      };
      expect(options.fileName).toBe('app-config');
    });

    test('should allow filePattern property', () => {
      const options: IConfigurationOptions = {
        filePattern: '{name}.{ext}'
      };
      expect(options.filePattern).toBe('{name}.{ext}');
    });

    test('should allow both fileName and filePattern', () => {
      const options: IConfigurationOptions = {
        fileName: 'custom-config',
        filePattern: '{name}.{env}.{ext}'
      };
      expect(options.fileName).toBe('custom-config');
      expect(options.filePattern).toBe('{name}.{env}.{ext}');
    });

    test('should allow empty options object', () => {
      const options: IConfigurationOptions = {};
      expect(options).toBeDefined();
      expect(options.fileName).toBeUndefined();
      expect(options.filePattern).toBeUndefined();
    });
  });

  describe('Type compatibility', () => {
    test('source accepts both enum and string literal', () => {
      const option1: IConfigVariableOptions = { source: EConfigSource.env };
      const option2: IConfigVariableOptions = { source: 'env' };
      
      expect(option1.source).toBe(option2.source);
    });

    test('all interfaces are optional properties', () => {
      // Should compile without errors
      const varOpts1: IConfigVariableOptions = {};
      const varOpts2: IConfigVariableOptions = { exclude: false };
      const varOpts3: IConfigVariableOptions = { source: 'both' };
      
      const confOpts1: IConfigurationOptions = {};
      const confOpts2: IConfigurationOptions = { fileName: 'test' };
      
      expect(varOpts1).toBeDefined();
      expect(varOpts2).toBeDefined();
      expect(varOpts3).toBeDefined();
      expect(confOpts1).toBeDefined();
      expect(confOpts2).toBeDefined();
    });
  });
});
