import BaseModule from './BaseModule'


export default class DataModule extends BaseModule {
  constructor(config) {
    super({
      moduleKey: config.moduleKey,
      reducerKey: config.reducerKey || config.moduleKey,
  
      initialState: {
        ...config.initialState,
        isLoading: false,
        isModifying: false,
        isError: false,
        isLoaded: false,
        lastUpdated: 0,
        data: config.initialData !== undefined ? config.initialData : [],
      }
    })

    this.isDataArray = Array.isArray(this.initialState.data)
    this.config.refreshTime = config.refreshTime != null ? config.refreshTime : 60000
    this.config.services = config.services
    this.config.idField = config.idField || 'id'

    this._configureSelectors()

    if (this.config.services.get) {
      this._configureGetService()
    }

    if (this.config.services.post) {
      this._configurePostService()
    }

    if (this.config.services.put) {
      this._configurePutService()
    }

    if (this.config.services.delete) {
      this._configureDeleteService()
    }
  }

  registerDataAction(actionKey, actionFunction) {
    this.registerActionKey(`${actionKey}Start`)
    this.registerActionKey(`${actionKey}Success`)
    this.registerActionKey(`${actionKey}Error`)
    this.actions[actionKey] = (...args) => actionFunction(...args)
  }

  _configureSelectors = () => {
    this.registerSelector('data', (state, moduleState) => moduleState.data, data => data)

    if (this.isDataArray) {
      this.registerSelector(
        'dataById',
        (state) => this.selectors.data(state),
        data => data.reduce((dataById, currentData) => {
          dataById[currentData[this.config.idField]] = currentData
          return dataById
        }, {})
      )
    }

    this.registerSelector('isLoading', (state, moduleState) => moduleState, state => state.isLoading)
    this.registerSelector('isModifying', (state, moduleState) => moduleState, state => state.isModifying)
  }

  _configureGetService = () => {
    this.registerDataAction('get', () => dispatch => {
      dispatch({ type: this.actionKeys.getStart })

      return new Promise((resolve, reject) => {
        this.config.services.get.service()
          .then(response => {
            dispatch({ type: this.actionKeys.getSuccess, payload: response })
            resolve(response)
          })
          .catch(error => {
            dispatch({ type: this.actionKeys.getError })
            reject(error)
          })
      })
    })

    this.registerAction('getIfNeeded', (...args) => (dispatch, getState) => {
      const moduleState = this._getModuleState(getState())
      let shouldFetch = false

      if (moduleState.isLoading || moduleState.isModifying) {
        shouldFetch = false
      } else if (!moduleState.data || (this.isDataArray && moduleState.data.length === 0 && !moduleState.lastUpdated)) {
        shouldFetch = true
      } else if ((Date.now() - moduleState.lastUpdated) >= this.config.refreshTime) {
        shouldFetch = true
      }

      return shouldFetch
        ? dispatch(this.actions.get(...args))
        : Promise.resolve()
    })

    this.registerReducer(this.actionKeys.getStart, state => ({
      ...state,
      isLoading: true,
      isError: false,
    }))
    
    this.registerReducer(this.actionKeys.getSuccess, (state, action) => ({
      ...state,
      isLoading: false,
      isLoaded: true,
      data: action.payload,
      lastUpdated: Date.now(),
    }))

    this.registerReducer(this.actionKeys.getError, (state) => ({
      ...state,
      isLoading: false,
      isError: true,
      data: this.initialState.data,
    }))
  }

  _configurePostService = () => {
    this.registerDataAction('post', data => dispatch => {
      dispatch({ type: this.actionKeys.postStart })

      return new Promise((resolve, reject) => {
        this.config.services.post.service(data)
          .then(response => {
            dispatch({ type: this.actionKeys.postSuccess, payload: response })
            resolve(response)
          })
          .catch(error => {
            dispatch({ type: this.actionKeys.postError })
            reject(error)
          })
      })
    })

    this.registerReducer(this.actionKeys.postStart, state => ({
      ...state,
      isModifying: true,
      isError: false,
    }))

    this.registerReducer(this.actionKeys.postSuccess, (state, action) => ({
      ...state,
      isModifying: false,
      data: this.isDataArray
        ? [...state.data, action.payload]
        : { ...state.data, [action.payload[this.config.idField]]: action.payload },
      lastUpdated: Date.now(),
    }))

    this.registerReducer(this.actionKeys.postError, state => ({
      ...state,
      isModifying: false,
      isError: true,
    }))
  }

  _configurePutService = () => {
    this.registerDataAction('put', data => dispatch => {
      dispatch({ type: this.actionKeys.putStart })

      return new Promise((resolve, reject) => {
        this.config.services.put.service(data)
          .then(response => {
            dispatch({ type: this.actionKeys.putSuccess, payload: response })
            resolve(response)
          })
          .catch(error => {
            dispatch({ type: this.actionKeys.putError })
            reject(error)
          })
      })
    })

    this.registerReducer(this.actionKeys.putStart, state => ({
      ...state,
      isModifying: true,
      isError: false,
    }))

    this.registerReducer(this.actionKeys.putSuccess, (state, action) => ({
      ...state,
      isModifying: false,
      data: this.isDataArray
        ? state.data.map(d => d[this.config.idField] === action.payload.id ? action.payload : d)
        : { ...state.data, [action.payload[this.config.idField]]: action.payload },
      lastUpdated: Date.now(),
    }))

    this.registerReducer(this.actionKeys.putError, (state) => ({
      ...state,
      isModifying: false,
      isError: true
    }))
  }

  _configureDeleteService = () => {
    this.registerDataAction('delete', id => dispatch => {
      dispatch({ type: this.actionKeys.deleteStart })

      return new Promise((resolve, reject) => {
        this.config.services.delete.service(id)
          .then(response => {
            dispatch({ type: this.actionKeys.deleteSuccess, payload: id })
            resolve()
          })
          .catch(error => {
            dispatch({ type: this.actionKeys.deleteError })
            reject(error)
          })
      })
    })

    this.registerReducer(this.actionKeys.deleteStart, state => ({
      ...state,
      isModifying: true,
      isError: false,
    }))

    this.registerReducer(this.actionKeys.deleteSuccess, (state, action) => {
      const data = (() => {
        if (this.isDataArray) {
          return state.data.filter(d => d[this.config.idField] !== action.payload)
        }

        const values = { ...action.payload }
        delete values[action.payload[this.config.idField]]
        return values
      })()

      return {
        ...state,
        isModifying: false,
        data: data,
        lastUpdated: Date.now(),
      }
    })

    this.registerReducer(this.actionKeys.deleteError, state => ({
      ...state,
      isModifying: false,
      isError: true,
    }))
  }
}
