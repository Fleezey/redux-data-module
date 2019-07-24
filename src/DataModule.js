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
        data: config.initialData || [],
      }
    })

    this.isDataArray = Array.isArray(this.initialState.data)
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
    this.registerActionKey('getStart')
    this.registerActionKey('getSuccess')
    this.registerActionKey('getError')
    
    this.actions.get = () =>
    dispatch => {
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
        }
        
    this.reducers[this.actionKeys.getStart] = (state, action) => ({
      ...state,
      isLoading: true,
      isError: false,
    })
    
    this.reducers[this.actionKeys.getSuccess] = (state, action) => ({
      ...state,
      isLoading: false,
      isLoaded: true,
      data: action.payload,
      lastUpdated: Date.now(),
    })
    
    this.reducers[this.actionKeys.getError] = (state, action) => ({
      ...state,
      isLoading: false,
      isError: true,
      data: this.initialState.data,
    })
  }

  _configurePostService = () => {
    this.registerActionKey('postStart')
    this.registerActionKey('postSuccess')
    this.registerActionKey('postError')

    this.actions.post = (data) =>
      dispatch => {
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
      }

    this.reducers[this.actionKeys.postStart] = (state) => ({
      ...state,
      isModifying: true,
      isError: false,
    })

    this.reducers[this.actionKeys.postSuccess] = (state, action) => ({
      ...state,
      isModifying: false,
      data: this.isDataArray
        ? [...state.data, action.payload]
        : { ...state.data, [action.payload[this.config.idField]]: action.payload },
      lastUpdated: Date.now(),
    })

    this.reducers[this.actionKeys.postError] = (state) => ({
      ...state,
      isModifying: false,
      isError: true,
    })
  }

  _configurePutService = () => {
    this.registerActionKey('putStart')
    this.registerActionKey('putSuccess')
    this.registerActionKey('putError')

    this.actions.put = (data) =>
      dispatch => {
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
      }

    this.reducers[this.actionKeys.putStart] = (state) => ({
      ...state,
      isModifying: true,
      isError: false,
    })
    
    this.reducers[this.actionKeys.putSuccess] = (state, action) => ({
      ...state,
      isModifying: false,
      data: this.isDataArray
        ? state.data.map(d => d[this.config.idField] === action.payload.id ? action.payload : d)
        : { ...state.data, [action.payload[this.config.idField]]: action.payload },
      lastUpdated: Date.now(),
    })

    this.reducers[this.actionKeys.putError] = (state) => ({
      ...state,
      isModifying: false,
      isError: true
    })
  }

  _configureDeleteService = () => {
    this.registerActionKey('deleteStart')
    this.registerActionKey('deleteSuccess')
    this.registerActionKey('deleteError')

    this.actions.delete = (id) =>
      dispatch => {
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
      }

    this.reducers[this.actionKeys.deleteStart] = (state) => ({
      ...state,
      isModifying: true,
      isError: false,
    })

    this.reducers[this.actionKeys.deleteSuccess] = (state, action) => {
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
    }

    this.reducers[this.actionKeys.deleteError] = (state) => ({
      ...state,
      isModifying: false,
      isError: true,
    })
  }
}
