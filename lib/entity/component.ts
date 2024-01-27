import { Component } from "../component.js";
import * as MC from "@minecraft/server";

export class EntityComponent<T extends MC.EntityComponent> extends Component<T> {}
