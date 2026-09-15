import React from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

export interface CardItem {
  id: string | number;
  title: string;
  subtitle: string;
  imageUrl: string;
  href: string;
}

export interface HoverRevealCardsProps {
  items: CardItem[];
  className?: string;
  cardClassName?: string;
}

const HoverRevealCards: React.FC<HoverRevealCardsProps> = ({
  items,
  className,
  cardClassName,
}) => {
  return (
    <div
      role="list"
      className={cn(
        'group grid w-full max-w-6xl grid-cols-1 gap-6 p-4 sm:grid-cols-2 md:grid-cols-3',
        className
      )}
    >
      {items.map((item) => (
        <Link
          href={item.href}
          key={item.id}
          role="listitem"
          aria-label={`${item.title}, ${item.subtitle}`}
          tabIndex={0}
          className={cn(
            'block relative h-[400px] cursor-pointer overflow-hidden rounded-2xl bg-cover bg-center shadow-lg transition-all duration-500 ease-in-out',
            'group-hover:scale-[0.97] group-hover:opacity-60 group-hover:blur-[2px]',
            'hover:!scale-105 hover:!opacity-100 hover:!blur-none focus-visible:!scale-105 focus-visible:!opacity-100 focus-visible:!blur-none',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-background',
            cardClassName
          )}
          style={{ backgroundImage: `url(${item.imageUrl})` }}
        >
          {/* Gradient overlay for text contrast */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-black/10 transition-opacity duration-300 group-hover:opacity-100" />

          {/* Card Content */}
          <div className="absolute bottom-0 left-0 p-8 text-white w-full">
            <p className="text-sm font-semibold uppercase tracking-widest opacity-90 text-blue-400">
              {item.subtitle}
            </p>
            <h3 className="mt-2 text-3xl font-bold">{item.title}</h3>
          </div>
        </Link>
      ))}
    </div>
  );
};

export default HoverRevealCards;
