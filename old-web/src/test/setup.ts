import '@testing-library/jest-dom';
import { vi } from 'vitest';
import React from 'react';

// Mock framer-motion to avoid animation issues in tests
vi.mock('framer-motion', () => ({
  motion: {
    div: React.forwardRef(function MockMotionDiv(
      props: React.HTMLAttributes<HTMLDivElement>,
      ref: React.Ref<HTMLDivElement>
    ) {
      const { children, ...rest } = props;
      // Filter out framer-motion specific props
      const filteredProps: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(rest)) {
        if (!['layout', 'layoutId', 'initial', 'animate', 'exit', 'whileHover', 'whileTap', 'drag', 'dragConstraints', 'dragSnapToOrigin', 'transition'].includes(key)) {
          filteredProps[key] = value;
        }
      }
      return React.createElement('div', { ...filteredProps, ref }, children);
    }),
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
}));
