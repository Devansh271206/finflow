-- SQL Migration to add category to goals table
ALTER TABLE goals
ADD COLUMN category text;
