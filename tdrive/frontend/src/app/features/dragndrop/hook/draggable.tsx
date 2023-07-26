import React from 'react';
import {useDraggable} from '@dnd-kit/core';

type DraggableProps={
  children: React.ReactNode
  //TODO[ASH] in it's an int why it's wny?
  index: any
}

export function Draggable(props:DraggableProps) {
  const {attributes, listeners, setNodeRef, transform} = useDraggable({
    id: `draggable-${props.index+1}`,
    data: {
      child: props.children
    },
  });
  const style = transform ? {
    transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
  } : undefined;

  
  return (
    <div ref={setNodeRef} {...listeners} {...attributes} style={style}>
      {props.children}
    </div>
  );
}