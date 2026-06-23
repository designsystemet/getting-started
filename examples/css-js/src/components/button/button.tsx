import type React from "react";
import classes from "./button.module.css";


type MyButtonProps = {
    type?: "primary";
}

export const MyButton: React.FC<MyButtonProps> = ({ type }) => {
    return <button type="button" className={classes.button}>my button: type {type}</button>;
};
