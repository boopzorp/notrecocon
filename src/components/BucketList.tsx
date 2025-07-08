
"use client";

import { useState } from 'react';
import { useAppContext } from '@/context/AppContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { PlusCircle, Trash2, ListTodo, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Skeleton } from './ui/skeleton';

export function BucketList() {
  const { bucketList, addBucketListItem, toggleBucketListItem, deleteBucketListItem, userRole, isLoadingBucketList } = useAppContext();
  const [newItemText, setNewItemText] = useState('');

  const handleAddItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (newItemText.trim()) {
      addBucketListItem(newItemText.trim());
      setNewItemText('');
    }
  };

  const todoItems = bucketList.filter(item => !item.completed);
  const completedItems = bucketList.filter(item => item.completed);

  const itemVariants = {
    hidden: { opacity: 0, y: -20 },
    visible: { opacity: 1, y: 0 },
    exit: { opacity: 0, x: -50, transition: { duration: 0.2 } },
  };

  return (
    <Card className="w-full max-w-2xl mx-auto shadow-lg text-left">
      <CardHeader>
        <CardTitle className="font-headline text-3xl text-primary flex items-center gap-2">
          <ListTodo /> Our Bucket List
        </CardTitle>
        <CardDescription>
          Dream big, one adventure at a time. Add items to our shared list!
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleAddItem} className="flex gap-2 mb-6">
          <Input
            type="text"
            value={newItemText}
            onChange={(e) => setNewItemText(e.target.value)}
            placeholder="e.g., See the Northern Lights"
            className="flex-grow"
            disabled={isLoadingBucketList}
          />
          <Button type="submit" disabled={!newItemText.trim() || isLoadingBucketList}>
            <PlusCircle /> Add
          </Button>
        </form>

        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-semibold mb-2 flex items-center gap-2 text-primary">
              <ListTodo /> To Do
            </h3>
             {isLoadingBucketList && bucketList.length === 0 ? (
                <div className="space-y-2">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                </div>
            ) : (
                <AnimatePresence>
                {todoItems.length > 0 ? (
                    <ul className="space-y-2">
                    {todoItems.map((item) => (
                        <motion.li
                        key={item.id}
                        layout
                        initial="hidden"
                        animate="visible"
                        exit="exit"
                        variants={itemVariants}
                        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                        className="flex items-center gap-3 p-2 rounded-md transition-colors bg-secondary/30 hover:bg-secondary/60"
                        >
                        <Checkbox
                            id={`item-${item.id}`}
                            checked={item.completed}
                            onCheckedChange={() => toggleBucketListItem(item.id, !item.completed)}
                            className="h-5 w-5"
                        />
                        <label htmlFor={`item-${item.id}`} className="flex-grow cursor-pointer text-sm">
                            {item.text}
                        </label>
                        {userRole === 'editor' && (
                            <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => deleteBucketListItem(item.id)}
                            className="h-7 w-7 text-muted-foreground hover:text-destructive"
                            aria-label="Delete item"
                            >
                            <Trash2 className="h-4 w-4" />
                            </Button>
                        )}
                        </motion.li>
                    ))}
                    </ul>
                ) : (
                    !isLoadingBucketList && <p className="text-sm text-muted-foreground text-center py-2">The adventure awaits! Add your first item.</p>
                )}
                </AnimatePresence>
            )}
          </div>

          {completedItems.length > 0 && (
            <div className="pt-4 border-t">
              <h3 className="text-lg font-semibold mb-2 flex items-center gap-2 text-gray-500">
                <CheckCircle2 /> Completed!
              </h3>
              <AnimatePresence>
                <ul className="space-y-2">
                  {completedItems.map((item) => (
                    <motion.li
                      key={item.id}
                      layout
                      initial="hidden"
                      animate="visible"
                      exit="exit"
                      variants={itemVariants}
                      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                      className="flex items-center gap-3 p-2 rounded-md"
                    >
                      <Checkbox
                        id={`item-${item.id}`}
                        checked={item.completed}
                        onCheckedChange={() => toggleBucketListItem(item.id, !item.completed)}
                        className="h-5 w-5"
                      />
                      <label
                        htmlFor={`item-${item.id}`}
                        className="flex-grow cursor-pointer text-sm text-muted-foreground line-through"
                      >
                        {item.text}
                      </label>
                       {userRole === 'editor' && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteBucketListItem(item.id)}
                          className="h-7 w-7 text-muted-foreground hover:text-destructive"
                          aria-label="Delete item"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </motion.li>
                  ))}
                </ul>
              </AnimatePresence>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
