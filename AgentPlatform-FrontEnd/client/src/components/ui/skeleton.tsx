import './skeleton.css';

interface SkeletonProps {
  width?: string;
  height?: string;
  radius?: string;
}

export const Skeleton = ({ width = '100%', height = '14px', radius }: SkeletonProps) => (
  <span
    className="skeleton"
    aria-hidden="true"
    style={{ width, height, borderRadius: radius ?? 'var(--radius-sm)' }}
  />
);
