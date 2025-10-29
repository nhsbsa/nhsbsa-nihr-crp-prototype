// Core dependencies
const {
  createReadStream,
  createWriteStream,
  existsSync,
  mkdirSync
} = require('node:fs')
const { join } = require('node:path')
const { format: urlFormat } = require('node:url')

// External dependencies
const bodyParser = require('body-parser')
const sessionInCookie = require('client-sessions')
const cookieParser = require('cookie-parser')
const dotenv = require('dotenv')
const express = require('express')
const sessionInMemory = require('express-session')
const nunjucks = require('nunjucks')

// Run before other code to make sure variables from .env are available
dotenv.config()

// Local dependencies
const config = require('./app/config')
const locals = require('./app/locals')
const routes = require('./app/routes')
const exampleTemplatesRoutes = require('./lib/example_templates_routes')
const authentication = require('./lib/middleware/authentication')
const automaticRouting = require('./lib/middleware/auto-routing')
const production = require('./lib/middleware/production')
const prototypeAdminRoutes = require('./lib/middleware/prototype-admin-routes')
const utils = require('./lib/utils')
const packageInfo = require('./package.json')

// Routers (make sure these files exist)
const researcherEntry = require('./app/researcher-entry')
const researcherFeasibility = require('./app/researcher-feasibility')
const researcherSubmit = require('./app/researcher-submit')
const researcherIdentifyStudy = require('./app/researcher-identify-study')
const researcherStudySites = require('./app/researcher-study-sites') // ← NEW

// Set configuration variables
const port = parseInt(process.env.PORT || config.port, 10) || 2000

// Initialise applications
const app = express()
const exampleTemplatesApp = express()

// IMPORTANT: trust Heroku’s proxy so req.protocol and x-forwarded-* are respected
app.set('trust proxy', 1)

// Set up configuration variables
const useAutoStoreData =
  process.env.USE_AUTO_STORE_DATA || config.useAutoStoreData
const useCookieSessionStore =
  process.env.USE_COOKIE_SESSION_STORE || config.useCookieSessionStore

// Add variables that are available in all views
app.locals.asset_path = '/public/'
app.locals.useAutoStoreData = useAutoStoreData === 'true'
app.locals.useCookieSessionStore = useCookieSessionStore === 'true'
app.locals.serviceName = config.serviceName

// Use cookie middleware to parse cookies
app.use(cookieParser())

// Nunjucks configuration for application
const appViews = [
  join(__dirname, 'app/views/'),
  join(__dirname, 'lib/example-templates/'),
  join(__dirname, 'lib/prototype-admin/'),
  join(__dirname, 'lib/templates/'),
  join(__dirname, 'node_modules/nhsuk-frontend/dist/nhsuk/components'),
  join(__dirname, 'node_modules/nhsuk-frontend/dist/nhsuk/macros'),
  join(__dirname, 'node_modules/nhsuk-frontend/dist/nhsuk'),
  join(__dirname, 'node_modules/nhsuk-frontend/dist')
]

/**
 * @type {import('nunjucks').ConfigureOptions}
 */
const nunjucksConfig = {
  autoescape: true,
  noCache: true,
  express: app
}

let nunjucksAppEnv = nunjucks.configure(appViews, nunjucksConfig)
nunjucksAppEnv.addGlobal('version', packageInfo.version)

// Add Nunjucks filters
utils.addNunjucksFilters(nunjucksAppEnv)

// Session uses service name to avoid clashes with other prototypes
const sessionName = `nhsuk-prototype-kit-${Buffer.from(config.serviceName, 'utf8').toString('hex')}`
const sessionOptions = {
  secret: sessionName,
  cookie: { maxAge: 1000 * 60 * 60 * 4 } // 4 hours
}

if (process.env.NODE_ENV === 'production') {
  app.use(production)
  app.use(authentication)
}

// Support session data in cookie or memory
const useCookie = useCookieSessionStore === 'true'
if (useCookie) {
  app.use(
    sessionInCookie(
      Object.assign(sessionOptions, {
        cookieName: sessionName,
        proxy: true,
        requestKey: 'session'
      })
    )
  )
} else {
  app.use(
    sessionInMemory(
      Object.assign(sessionOptions, {
        name: sessionName,
        resave: false,
        saveUninitialized: false
      })
    )
  )
}

// Support for parsing data in POSTs
app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: true }))

// Automatically store all data users enter
if (useAutoStoreData === 'true') {
  app.use(utils.autoStoreData)
  utils.addCheckedFunction(nunjucksAppEnv)
}

app.use(utils.setLocals)

// initial checks
function checkFiles() {
  const nodeModulesExists = existsSync(join(__dirname, '/node_modules'))
  if (!nodeModulesExists) {
    throw new Error('ERROR: Node module folder missing. Try running `npm install`')
  }
  const envExists = existsSync(join(__dirname, '/.env'))
  if (!envExists) {
    createReadStream(join(__dirname, '/lib/template.env')).pipe(
      createWriteStream(join(__dirname, '/.env'))
    )
  }
}
checkFiles()

// Create template session data defaults file if it doesn't exist
const dataDirectory = join(__dirname, '/app/data')
const sessionDataDefaultsFile = join(dataDirectory, '/session-data-defaults.js')
const sessionDataDefaultsFileExists = existsSync(sessionDataDefaultsFile)
if (!sessionDataDefaultsFileExists) {
  console.log('Creating session data defaults file')
  if (!existsSync(dataDirectory)) mkdirSync(dataDirectory)
  createReadStream(join(__dirname, '/lib/template.session-data-defaults.js'))
    .pipe(createWriteStream(sessionDataDefaultsFile))
}

// Local variables
app.use(require('./app/locals')(config))

// View engines
app.set('view engine', 'html')
const exampleTemplatesAppEnv = nunjucks.configure(appViews, {
  autoescape: true,
  express: exampleTemplatesApp
})
exampleTemplatesAppEnv.addGlobal('version', packageInfo.version)
utils.addNunjucksFilters(exampleTemplatesAppEnv)

// Use public folder for static assets
app.use(express.static(join(__dirname, 'public')))
app.use(
  '/nhsuk-frontend',
  express.static(join(__dirname, 'node_modules/nhsuk-frontend/dist/nhsuk'))
)

/* ------------------------------------------------------------------
   MOUNT YOUR REAL APP ROUTERS HERE — BEFORE generic routes/redirects
   ------------------------------------------------------------------ */
app.use(researcherEntry)
app.use(researcherFeasibility)
app.use(researcherSubmit)
app.use(researcherIdentifyStudy)
app.use(researcherStudySites) // ← NEW: serves /researcher/study-sites

/* ------------------------------------------------------------------
   Example template routes (kit defaults)
   ------------------------------------------------------------------ */
app.use('/example-templates', exampleTemplatesApp)
exampleTemplatesApp.use('/', exampleTemplatesRoutes)
exampleTemplatesApp.get(/^([^.]+)$/, (req, res, next) => {
  automaticRouting.matchRoutes(req, res, next)
})

/* ------------------------------------------------------------------
   Use custom application routes (MUST be before auto-routing)
   ------------------------------------------------------------------ */
app.use('/', routes)

// Prototype admin
app.use('/prototype-admin', prototypeAdminRoutes)

/* ------------------------------------------------------------------
   TEMP: soak up links to unbuilt /prototypes/* pages so logs stop 404ing
   ------------------------------------------------------------------ */
const prototypeHolders = [
  '/prototypes/approve-requests',
  '/prototypes/study-matching',
  '/prototypes/submit-study',
  '/prototypes/manage-requests'
]
app.get(prototypeHolders, (req, res) => {
  res.status(501).send(
    `<div style="font:16px/1.4 -apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial,sans-serif;padding:24px">
      <h1 style="margin:0 0 8px">Coming soon</h1>
      <p>This placeholder exists so you can click around without blowing up the logs.</p>
      <p>Build a template at <code>app/views${req.path}.html</code> or wire a real route.</p>
    </div>`
  )
})

/* ------------------------------------------------------------------
   Redirect all unmatched POSTs to GETs (Prototype Kit behaviour)
   ------------------------------------------------------------------ */
app.post(/^\/([^.]+)$/, (req, res) => {
  res.redirect(
    urlFormat({
      pathname: `/${req.params[0]}`,
      query: req.query
    })
  )
})

/** AUTO-ROUTING FOR APP — MOUNT LAST */
app.get(/^([^.]+)$/, (req, res, next) => {
  console.log('[app] auto-routing (last) matching', req.path)
  automaticRouting.matchRoutes(req, res, next)
})

// Catch 404 and forward to error handler
app.use((req, res, next) => {
  const err = new Error(`Page not found: ${req.path}`)
  err.status = 404
  next(err)
})

// Display error
app.use((err, req, res) => {
  console.error(err.message)
  res.status(err.status || 500)
  res.send(err.message)
})

// Run the application
app.listen(port)
if (process.env.WATCH !== 'true' && process.env.NODE_ENV !== 'production') {
  console.info(`Running at http://localhost:${port}/`)
  console.info('')
  console.warn('Warning: It looks like you may have run the command \`npm start\` locally.')
  console.warn('Press \`Ctrl+C\` and then run \`npm run watch\` instead')
}

module.exports = app
