import { Search } from 'lucide-react';
import { motion } from 'framer-motion';

/**
 * Shared empty state for:
 * 1. Trains nearby
 * 2. Find a train
 * 3. Between stations
 *
 * Edit this component once to update all three sections.
 */
export default function EmptyState({
  icon: Icon = Search,
  title,
  description,
}) {
  return (
    <motion.div
      className="empty-state"
      role="status"
      aria-live="polite"
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18, ease: 'easeOut' }}
    >
      <span className="empty-state-icon" aria-hidden="true">
        <Icon size={25} strokeWidth={2.1} />
      </span>

      <div className="empty-state-copy">
        <h3>{title}</h3>
        <p>{description}</p>
      </div>
    </motion.div>
  );
}