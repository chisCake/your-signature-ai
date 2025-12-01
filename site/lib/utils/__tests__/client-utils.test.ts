import { cn } from '@/lib/utils/client-utils';

describe('client-utils', () => {
  describe('cn', () => {
    it('should merge class names correctly', () => {
      const result = cn('class1', 'class2', 'class3');
      expect(result).toContain('class1');
      expect(result).toContain('class2');
      expect(result).toContain('class3');
    });

    it('should handle conditional classes', () => {
      const condition = true;
      const result = cn('base-class', condition && 'conditional-class');
      expect(result).toContain('base-class');
      expect(result).toContain('conditional-class');
    });

    it('should handle false conditional classes', () => {
      const condition = false;
      const result = cn('base-class', condition && 'conditional-class');
      expect(result).toContain('base-class');
      expect(result).not.toContain('conditional-class');
    });

    it('should handle null and undefined', () => {
      const result = cn('base-class', null, undefined, 'other-class');
      expect(result).toContain('base-class');
      expect(result).toContain('other-class');
    });

    it('should merge tailwind classes correctly (tailwind-merge)', () => {
      // tailwind-merge should remove conflicting classes
      const result = cn('px-2', 'px-4');
      // The result should only contain one px-* class (px-4 wins)
      expect(result).not.toContain('px-2');
      expect(result).toContain('px-4');
    });

    it('should handle empty strings', () => {
      const result = cn('', 'class1', '', 'class2');
      expect(result).toContain('class1');
      expect(result).toContain('class2');
    });

    it('should handle arrays of classes', () => {
      const result = cn(['class1', 'class2'], 'class3');
      expect(result).toContain('class1');
      expect(result).toContain('class2');
      expect(result).toContain('class3');
    });

    it('should handle objects with conditional classes', () => {
      const result = cn({
        class1: true,
        class2: false,
        class3: true,
      });
      expect(result).toContain('class1');
      expect(result).not.toContain('class2');
      expect(result).toContain('class3');
    });

    it('should handle complex combinations', () => {
      const result = cn(
        'base-class',
        true && 'conditional-class',
        false && 'should-not-appear',
        {
          'object-class': true,
          'object-class-false': false,
        },
        ['array-class1', 'array-class2'],
        null,
        undefined
      );

      expect(result).toContain('base-class');
      expect(result).toContain('conditional-class');
      expect(result).not.toContain('should-not-appear');
      expect(result).toContain('object-class');
      expect(result).not.toContain('object-class-false');
      expect(result).toContain('array-class1');
      expect(result).toContain('array-class2');
    });

    it('should handle tailwind conflicting classes with different variants', () => {
      // Test that tailwind-merge properly handles conflicting classes
      const result = cn('bg-red-500', 'bg-blue-500');
      // Should only contain one bg-* class
      expect(result).toContain('bg-blue-500');
      expect(result).not.toContain('bg-red-500');
    });

    it('should preserve non-conflicting tailwind classes', () => {
      const result = cn('px-4', 'py-2', 'bg-red-500');
      expect(result).toContain('px-4');
      expect(result).toContain('py-2');
      expect(result).toContain('bg-red-500');
    });

    it('should return empty string for all falsy values', () => {
      const result = cn(null, undefined, false, '');
      expect(result).toBe('');
    });

    it('should handle mixed string and object inputs', () => {
      const result = cn(
        'string-class',
        {
          'object-class': true,
        },
        'another-string'
      );
      expect(result).toContain('string-class');
      expect(result).toContain('object-class');
      expect(result).toContain('another-string');
    });
  });
});
