import type React from "react";
import classes from "./button.module.css";

export const MyButton: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement>> = () => {
    return <button type="button" className={classes.button}>Button</button>;
};
