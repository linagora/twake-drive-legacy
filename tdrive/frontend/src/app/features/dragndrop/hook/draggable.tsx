import React, { MouseEventHandler } from 'react';
import {useDraggable} from '@dnd-kit/core';

type DraggableProps={
  children: React.ReactNode
  id: number
}

export function Draggable(props:DraggableProps) {
  const {attributes, listeners, setNodeRef, transform} = useDraggable({
    id: `draggable-${props.id+1}`,
    data: {
      child: props.children
    },
  });

  return (
    <div ref={setNodeRef} {...listeners} {...attributes}>
      {props.children}
    </div>
  );
}