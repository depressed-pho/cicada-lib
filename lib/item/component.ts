import { Component } from "../component.js";
import * as MC from "@minecraft/server";

export class ItemComponent<T extends MC.ItemComponent> extends Component<T> {}
