import { createSelector } from 'reselect'


export default class BaseModule {
  constructor(options) {
    this.config = {
      moduleKey: options.moduleKey,
      reducerKey: options.reducerKey || options.moduleKey,
    }
    
    this.initialState = {
      ...options.initialState,
    }
    
    this.selectors = {}
    this.actions = {}
    this.reducers = {}
    this.actionKeys = {}

    this.actionKeyPrefix = options.actionKeyPrefix || (() => {
      const parts = []
      parts.push(...options.moduleKey.split(/(?=[A-Z])/))
      return parts.join('_').toUpperCase()
    })()

    this.reducers.index = (state = this.initialState, action) => (this.reducers[action.type] ? this.reducers[action.type](state, action) : state)
  }

  registerSelector(selectorName, selectState, selector) {
    const selectStates = Array.isArray(selectState) ? selectState : [selectState]
    
    const stateSelector = (state) => {
      const moduleState = this._getModuleState(state)
      return selectStates.map(selectStateFunc => selectStateFunc(state, moduleState))
    }
    
    this.selectors[selectorName] = createSelector(stateSelector, (args) => selector(...args))
  }

  registerActionKey(actionKey) {
    const splitActionKey = actionKey.split(/(?=[A-Z)])/).join('_').toUpperCase()
    this.actionKeys[actionKey] = `${this.actionKeyPrefix}/${splitActionKey}`
  }

  registerAction(actionKey, actionFunction) {
    this.registerActionKey(actionKey)
    this.actions[actionKey] = (...args) => actionFunction(...args)
    return this.actionKeys[actionKey]
  }

  registerReducer(reducerKey, reducerFunction, extraArgsFunction) {
    this.reducers[reducerKey] = (state, action) => {
      let extraArgs = extraArgsFunction ? extraArgsFunction(state, action) : []

      if (!Array.isArray(extraArgs)) {
        extraArgs = [extraArgs]
      }

      return reducerFunction(state, action, ...extraArgs)
    }
  }

  _getModuleState = (state) => {
    return this.config.reducerKey.split('.').reduce((o, v) => (typeof o === 'undefined' || o === null ? o : o[v]), state) || this.initialState
  }
}
