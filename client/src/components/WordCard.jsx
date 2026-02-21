import React from 'react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Trash2, ExternalLink } from "lucide-react";

const WordCard = ({ word, onDelete }) => {
  return (
    <Card className="group relative overflow-hidden transition-all duration-300 hover:shadow-lg hover:shadow-primary/5 hover:border-primary/50 bg-card/50 backdrop-blur-sm">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-secondary/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
      
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
        <CardTitle className="text-2xl font-bold capitalize bg-gradient-to-r from-foreground to-muted-foreground bg-clip-text text-transparent">
          {word.word}
        </CardTitle>
        <Badge variant={word.mastered ? "default" : "secondary"} className="text-[10px] font-mono">
            {word.mastered ? 'MASTERED' : 'LEARNING'}
        </Badge>
      </CardHeader>
      
      <CardContent className="space-y-4">
        <p className="text-muted-foreground leading-relaxed">
          {word.definition}
        </p>

        <div className="space-y-2">
          {word.examples.map((ex, i) => (
            <div key={i} className="flex gap-2 text-sm text-muted-foreground/80 italic border-l-2 border-primary/20 pl-3">
              <span className="text-primary font-bold opacity-50">"</span>
              <p>{ex}</p>
            </div>
          ))}
        </div>
      </CardContent>

      <CardFooter className="pt-2 flex justify-between opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
        <Button variant="ghost" size="sm" className="text-xs h-8 text-primary hover:text-primary hover:bg-primary/10">
            <ExternalLink className="w-3 h-3 mr-2" /> Context
        </Button>
        
        <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => onDelete(word._id)}
            className="text-xs h-8 text-destructive hover:text-destructive hover:bg-destructive/10"
        >
            <Trash2 className="w-3 h-3 mr-2" /> Delete
        </Button>
      </CardFooter>
    </Card>
  );
};

export default WordCard;
