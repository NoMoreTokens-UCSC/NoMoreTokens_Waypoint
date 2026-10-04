import { test, expect, type Page } from '@playwright/test'

const rows = (page: Page) => page.locator('.ad-table tbody tr')
const vehicleSelect = (page: Page) =>
  page.locator('label.ad-field').filter({ hasText: 'Vehicle' }).locator('select')
const outletSelect = (page: Page) =>
  page.locator('label.ad-field').filter({ hasText: 'Outlet' }).locator('select')
const putDriverOnRoute = async (page: Page) => {
  await page.goto('/demo')
  const toggle = page.getByRole('switch', { name: 'Driver on route' })
  await toggle.click()
  await expect(toggle).toBeChecked()
}

test.describe('administration', () => {
  test('the team list shows the totals, the people in order, and filters', async ({ page }) => {
    await page.goto('/administration/team')
    const totals = page.getByRole('region', { name: 'Team totals' })
    await expect(totals).toContainText('48')
    await expect(totals).toContainText('41')
    await expect(totals).toContainText('Suspended')
    await expect(rows(page)).toHaveCount(6)
    await expect(rows(page).first()).toContainText('Kasun Fernando')
    await expect(rows(page).nth(2)).toContainText('Sanjeewa Bandara')
    await expect(rows(page).nth(2)).toContainText('On route')
    await expect(page.getByText('Showing 6 of 48 users')).toBeVisible()
    await page.getByLabel('Search name, mobile or outlet').fill('chamari')
    await expect(rows(page)).toHaveCount(1)
    await page.getByLabel('Search name, mobile or outlet').fill('')
    await page.getByRole('button', { name: 'Filter by roles' }).click()
    await page.getByRole('menuitem', { name: 'Store manager' }).click()
    await expect(rows(page)).toHaveCount(2)
    await page.getByRole('button', { name: 'Filter by depots' }).click()
    await page.getByRole('menuitem', { name: 'Kandy' }).click()
    await expect(page.getByText('No one matches these filters.')).toBeVisible()
  })

  test('adding a user creates sign-in details to hand over, and lists them as invited', async ({
    page,
  }) => {
    await page.goto('/administration/team')
    await page.getByRole('link', { name: 'Add user' }).first().click()
    await expect(page.getByRole('heading', { name: 'Add user' })).toBeVisible()
    await page.getByRole('radio', { name: /Loader/ }).click()
    // The form follows the role: a loader gets a dock bay, not a vehicle.
    await expect(page.getByLabel('Dock bay')).toBeVisible()
    await expect(page.getByText('See their route and stop sequence')).toHaveCount(0)
    // A password is already generated for the administrator to hand over.
    await expect(page.getByLabel('Temporary password')).toHaveValue(/^[A-Za-z0-9]{12}$/)
    await page.getByRole('button', { name: 'Create user' }).click()
    await expect(page.getByText('Enter their full name.')).toBeVisible()
    await expect(page.getByText('Enter a Sri Lankan mobile such as +94 77 123 4567.')).toBeVisible()
    await expect(page.getByText('Enter their email address.')).toBeVisible()
    await expect(page.getByText('Enter a username.')).toBeVisible()
    await page.getByLabel('Full name').fill('Dilani Rajapaksa')
    // The username follows the name until it is edited.
    await expect(page.getByLabel('Username')).toHaveValue('dilani.rajapaksa')
    await page.getByLabel('Mobile number').fill('+94 77 555 0101')
    await page.getByLabel('Email').fill('dilani@example.test')
    await page.getByLabel('Dock bay').selectOption('Dock bay 04')
    const password = await page.getByLabel('Temporary password').inputValue()
    await page.getByRole('button', { name: 'Create user' }).click()
    await expect(page.getByRole('heading', { name: 'Dilani’s account is ready.' })).toBeVisible()
    await expect(page.getByText('This system does not send them')).toBeVisible()
    await expect(page.getByText('dilani.rajapaksa', { exact: true })).toBeVisible()
    await expect(page.getByText(password, { exact: true })).toBeVisible()
    // Shown once: reloading loses the password and goes back to the team.
    await page.reload()
    await expect(page).toHaveURL(/\/administration\/team$/)
    await expect(rows(page)).toHaveCount(7)
    await expect(rows(page).filter({ hasText: 'Dilani Rajapaksa' })).toContainText('Invited')
    await expect(page.getByRole('region', { name: 'Team totals' })).toContainText('49')
    await page.getByRole('link', { name: 'Dilani Rajapaksa' }).click()
    await expect(page.getByRole('region', { name: 'Access' })).toContainText('dilani.rajapaksa')
    await expect(page.getByRole('region', { name: 'Access' })).toContainText('dilani@example.test')
    await expect(page.getByRole('region', { name: 'Access' })).toContainText(
      'Account created · not signed in yet',
    )
    // The password is not kept anywhere in the saved data.
    const stored = await page.evaluate(
      (word) =>
        new Promise<boolean>((resolve) => {
          const open = indexedDB.databases ? indexedDB.databases() : Promise.resolve([])
          open.then(async (databases) => {
            for (const info of databases) {
              if (!info.name) continue
              const db = await new Promise<IDBDatabase>((done) => {
                const request = indexedDB.open(info.name!)
                request.onsuccess = () => done(request.result)
              })
              for (const name of Array.from(db.objectStoreNames)) {
                const rowsOf = await new Promise<unknown[]>((done) => {
                  const request = db.transaction(name).objectStore(name).getAll()
                  request.onsuccess = () => done(request.result)
                })
                if (JSON.stringify(rowsOf).includes(word)) return resolve(true)
              }
            }
            resolve(false)
          })
        }),
      password,
    )
    expect(stored).toBe(false)
  })

  test('a username that is already taken is refused', async ({ page }) => {
    await page.goto('/administration/team/new')
    await page.getByLabel('Full name').fill('Another Person')
    await page.getByLabel('Username').fill('nimal.perera')
    await page.getByLabel('Mobile number').fill('+94 77 555 0303')
    await page.getByLabel('Email').fill('nimal@example.test')
    await vehicleSelect(page).selectOption({ index: 1 })
    await page.getByRole('button', { name: 'Create user' }).click()
    await expect(page.getByText('That username is already taken.')).toBeVisible()
    await expect(
      page.getByText('That email address already belongs to a team member.'),
    ).toBeVisible()
    await page.getByLabel('Email').fill('not-an-email')
    await page.getByRole('button', { name: 'Create user' }).click()
    await expect(page.getByText('Enter a valid email address.')).toBeVisible()
    await page.getByLabel('Email').fill('another@example.test')
    await page.getByLabel('Username').fill('another.person')
    await page.getByLabel('Temporary password').fill('short')
    await page.getByRole('button', { name: 'Create user' }).click()
    await expect(
      page.getByText('Use at least 8 characters, with letters and numbers.'),
    ).toBeVisible()
    await page.getByRole('button', { name: 'Generate' }).click()
    await page.getByRole('button', { name: 'Create user' }).click()
    await expect(page.getByRole('heading', { name: 'Another’s account is ready.' })).toBeVisible()
  })

  test('a person’s page shows their assignment, access and activity', async ({ page }) => {
    await page.goto('/administration/team')
    await page.getByRole('link', { name: 'Sanjeewa Bandara' }).click()
    await expect(page.getByRole('heading', { name: 'Sanjeewa Bandara', level: 1 })).toBeVisible()
    const assignment = page.getByRole('region', { name: 'Assignment' })
    await expect(assignment).toContainText('VEH055')
    await expect(assignment).toContainText('05:44 · near Peliyagoda')
    await expect(page.getByRole('region', { name: 'Access' })).toContainText('Driver · mobile web')
    await expect(page.getByRole('region', { name: 'Recent activity' })).toContainText(
      'Submitted delivery proof',
    )
  })

  test('role, reset and suspend work from a person’s page', async ({ page }) => {
    await page.goto('/administration/team/USR004')
    await page.getByRole('button', { name: 'Change role' }).click()
    await page.getByRole('radio', { name: /Dispatcher/ }).click()
    await page.getByRole('dialog').getByRole('button', { name: 'Change role' }).click()
    await expect(page.getByText('Nimal Perera is now a dispatcher')).toBeVisible()
    await page.getByRole('button', { name: 'Reset access' }).click()
    const reset = page.getByRole('dialog')
    const next = await reset.getByLabel('New temporary password').inputValue()
    expect(next).toMatch(/^[A-Za-z0-9]{12}$/)
    await reset.getByRole('button', { name: 'Reset access' }).click()
    // The new password is shown once, for the administrator to hand over.
    await expect(reset.getByText('this system does not send it', { exact: false })).toBeVisible()
    await expect(reset.getByText(next, { exact: true })).toBeVisible()
    await expect(reset.getByText('nimal.perera', { exact: true })).toBeVisible()
    await reset.getByRole('button', { name: 'Done' }).click()
    await page.getByRole('button', { name: 'Suspend user' }).click()
    await page.getByRole('dialog').getByRole('button', { name: 'Suspend user' }).click()
    await expect(page.getByText('Nimal Perera was suspended')).toBeVisible()
    await page.goto('/administration/team')
    const row = rows(page).filter({ hasText: 'Nimal Perera' })
    await expect(row).toContainText('Dispatcher')
    await expect(row).toContainText('Suspended')
    await page.goto('/administration/audit')
    await expect(page.locator('.ad-table').getByText('Demo role updated')).toBeVisible()
  })

  test('suspending a driver on route is blocked until the trip is handled', async ({ page }) => {
    await putDriverOnRoute(page)
    await page.goto('/administration/team/USR001')
    await expect(page.getByText('On route · Trip 1')).toBeVisible()
    await page.getByRole('button', { name: 'Suspend user' }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog.getByText('Blocked · driver is on route')).toBeVisible()
    await expect(dialog.getByText(/Sanjeewa is on Trip 1 with \d+ cases on board\./)).toBeVisible()
    // Handing the trip over needs another free driver at the depot, and there is none.
    await expect(dialog.getByText('No Peliyagoda driver is free right now.')).toBeVisible()
    await dialog.getByRole('button', { name: 'Reassign trip' }).click()
    await expect(dialog.getByText('Choose a driver to take the trip.')).toBeVisible()
    // Suspending now needs a reason.
    await dialog.getByRole('radio', { name: /Suspend now/ }).click()
    await dialog.getByRole('button', { name: 'Suspend now' }).click()
    await expect(dialog.getByText('Give a reason to suspend now.')).toBeVisible()
    // Suspending after the trip schedules it and keeps access until then.
    await dialog.getByRole('radio', { name: /Suspend after the trip ends/ }).click()
    await dialog.getByRole('button', { name: 'Schedule suspension' }).click()
    await expect(page.getByText('Suspension scheduled for after the trip')).toBeVisible()
    await expect(page.getByText('Suspends after trip').first()).toBeVisible()
  })

  test('suspending now with a reason ends access and alerts the dispatcher', async ({ page }) => {
    await putDriverOnRoute(page)
    await page.goto('/administration/team/USR001?do=suspend')
    const dialog = page.getByRole('dialog')
    await dialog.getByRole('radio', { name: /Suspend now/ }).click()
    await dialog.getByLabel('Reason').fill('Vehicle broke down on the Kandy road')
    await dialog.getByRole('button', { name: 'Suspend now' }).click()
    await expect(page.getByText('Sanjeewa Bandara was suspended')).toBeVisible()
    await page.goto('/administration/audit')
    await expect(page.locator('.ad-table').getByText('Suspended mid-route')).toBeVisible()
  })

  test('roles and access shows what each role can do', async ({ page }) => {
    await page.goto('/administration/roles')
    await expect(page.getByRole('heading', { name: 'Roles & access', level: 1 })).toBeVisible()
    const matrix = page.locator('.ad-matrix')
    await expect(matrix.locator('tbody tr')).toHaveCount(11)
    await expect(matrix.locator('thead th')).toHaveCount(6)
    await expect(matrix.getByText('Own outlet')).toBeVisible()
    await expect(matrix.getByText('Own route')).toBeVisible()
    await expect(page.getByText('5 roles · 11 capabilities')).toBeVisible()
    await expect(
      page.getByText('The Administrator cannot allocate, load or deliver.'),
    ).toBeVisible()
  })

  test('the audit log can be searched, filtered and exported', async ({ page }) => {
    await page.goto('/administration/audit')
    await expect(rows(page)).toHaveCount(7)
    await expect(page.getByText('Showing 1–7 of 214 events')).toBeVisible()
    await page.getByLabel('Search person, action or record').fill('ruwan')
    await expect(rows(page)).toHaveCount(1)
    await page.getByLabel('Search person, action or record').fill('')
    await page.getByRole('button', { name: 'Filter by time' }).click()
    await page.getByRole('menuitem', { name: 'Today' }).click()
    await expect(rows(page)).toHaveCount(4)
    await page.getByRole('button', { name: 'Filter by action' }).click()
    await page.getByRole('menuitem', { name: 'Sent invite' }).click()
    await expect(rows(page)).toHaveCount(1)
    const download = page.waitForEvent('download')
    await page.getByRole('button', { name: 'Export CSV' }).click()
    const file = await download
    expect(file.suggestedFilename()).toBe('waypoint-audit-log.csv')
  })

  test('assignments can be changed', async ({ page }) => {
    await page.goto('/administration/assignments')
    await page.getByRole('button', { name: 'Change assignment for Ruwan Silva' }).click()
    const dialog = page.getByRole('dialog')
    await dialog.getByLabel('Assignment').fill('Dock bay 05')
    await dialog.getByRole('button', { name: 'Save assignment' }).click()
    await expect(page.getByText('Assignment changed')).toBeVisible()
    await expect(rows(page).filter({ hasText: 'Ruwan Silva' })).toContainText('Dock bay 05')
  })

  test('the header search finds people', async ({ page }) => {
    await page.goto('/administration/team')
    await page.getByLabel('Search the workspace').fill('ishara')
    await page
      .getByRole('link', { name: /Ishara Gunawardena/ })
      .first()
      .click()
    await expect(page).toHaveURL(/\/administration\/team\/USR006$/)
  })

  test('on a phone the team is a list of cards and adding a user takes two steps', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/administration/team')
    await expect(page.getByText('41 active · 5 invited · 2 suspended')).toBeVisible()
    await expect(page.getByRole('link', { name: /Kasun Fernando/ })).toBeVisible()
    await expect(page.locator('.ad-table-card')).toBeHidden()
    await page.locator('.ad-bottom-bar').getByRole('link', { name: 'Add user' }).click()
    await expect(page.getByText('Step 1 of 2 · Role and details')).toBeVisible()
    await page.getByRole('radio', { name: 'Driver' }).click()
    await page.getByRole('button', { name: 'Continue' }).click()
    // Without a name the first step stays put and says why.
    await expect(page.getByText('Enter their full name.')).toBeVisible()
    await expect(page.getByText('Step 1 of 2 · Role and details')).toBeVisible()
    await page.getByLabel('Full name').fill('Chamod Perera')
    await page.getByRole('button', { name: 'Continue' }).click()
    await expect(page.getByText('Step 2 of 2 · Contact and assignment')).toBeVisible()
    await page.getByLabel('Mobile number').fill('+94 77 555 0202')
    await page.getByLabel('Email').fill('chamod@example.test')
    await vehicleSelect(page).selectOption({ index: 1 })
    await page.getByRole('button', { name: 'Create user' }).click()
    await expect(page.getByRole('heading', { name: 'Chamod’s account is ready.' })).toBeVisible()
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    )
    expect(overflow).toBeLessThanOrEqual(0)
  })

  test('an administrator adds an outlet and then assigns a store manager to it', async ({
    page,
  }) => {
    await page.goto('/administration/outlets')
    await expect(page.getByRole('heading', { name: 'Outlets', level: 1 })).toBeVisible()
    await expect(rows(page).filter({ hasText: 'OUT001' })).toContainText('Nimal Perera')
    await page.getByLabel('Search outlet, name or district').fill('OUT019')
    await expect(rows(page)).toHaveCount(1)
    await expect(rows(page)).toContainText('No manager')
    await page.getByLabel('Search outlet, name or district').fill('')
    await page.getByRole('link', { name: 'Add outlet' }).click()
    await page.getByRole('button', { name: 'Add outlet' }).click()
    await expect(page.getByText('Enter the outlet name.')).toBeVisible()
    await expect(page.getByText('Enter the district.')).toBeVisible()
    await page.getByRole('radio', { name: /Waypoint Style/ }).click()
    await page.getByLabel('Outlet name').fill('Style Odel')
    await page.getByLabel('District').fill('Colombo')
    await page.getByRole('radio', { name: /Mall delivery window/ }).click()
    await page.getByLabel('Mall opens deliveries at').selectOption('06:00')
    await page.getByLabel('Mall stops deliveries at').selectOption('09:30')
    await page.getByRole('button', { name: 'Add outlet' }).click()
    await expect(page.getByRole('heading', { name: 'Style Odel', level: 1 })).toBeVisible()
    const id = (await page.getByText(/^OUT\d+ · Peliyagoda depot$/).textContent())!.slice(0, 6)
    await expect(page.getByText('6:00 AM – 9:30 AM').first()).toBeVisible()
    await expect(page.getByText('No store manager yet.')).toBeVisible()
    // The outlet is on the list.
    await page.goto('/administration/outlets')
    await page.getByLabel('Search outlet, name or district').fill(id)
    await expect(rows(page).filter({ hasText: id })).toContainText('Style')
    // Add a store manager from the outlet's page: the outlet is already chosen.
    await page.getByRole('link', { name: id, exact: true }).click()
    await page.getByRole('link', { name: 'Add store manager' }).click()
    await expect(outletSelect(page)).toHaveValue(`${id} · Style`)
    await page.getByLabel('Full name').fill('Ayesha Fernando')
    await page.getByLabel('Mobile number').fill('+94 77 555 0111')
    await page.getByLabel('Email').fill('ayesha@example.test')
    await page.getByRole('button', { name: 'Create user' }).click()
    await expect(page.getByRole('heading', { name: 'Ayesha’s account is ready.' })).toBeVisible()
    // The outlet now shows its manager and is no longer offered to another one.
    await page.goto(`/administration/outlets/${id}`)
    await expect(page.getByText('Ayesha Fernando').first()).toBeVisible()
    await page.goto('/administration/team/new')
    await page.getByRole('radio', { name: /Store manager/ }).click()
    await expect(outletSelect(page).locator(`option[value^="${id}"]`)).toHaveCount(0)
    await expect(outletSelect(page).locator('option[value^="OUT019"]')).toHaveCount(1)
  })

  test('an outlet the administrator added can be opened as a store workspace', async ({ page }) => {
    await page.goto('/administration/outlets/new')
    await page.getByLabel('Outlet name').fill('Fresh Ja-Ela')
    await page.getByLabel('District').fill('Ja-Ela')
    await page.getByRole('button', { name: 'Add outlet' }).click()
    await expect(page.getByRole('heading', { name: 'Fresh Ja-Ela', level: 1 })).toBeVisible()
    await page.goto('/demo')
    const added = page.getByLabel('Store outlet').locator('option', { hasText: 'Fresh Ja-Ela' })
    await page.getByLabel('Store outlet').selectOption((await added.getAttribute('value'))!)
    await expect(page.getByText('Store workspace switched').first()).toBeVisible()
    await page.goto('/store-manager/orders/new')
    await expect(page.getByRole('heading', { name: 'Create orders' })).toBeVisible()
    await expect(page.getByText(/OUT\d+ · Fresh only/)).toBeVisible()
  })

  test('an administrator adds a vehicle and then assigns a driver to it', async ({ page }) => {
    await page.goto('/administration/vehicles')
    await expect(page.getByRole('heading', { name: 'Vehicles', level: 1 })).toBeVisible()
    await expect(page.getByText('Showing 1–10 of 60 vehicles')).toBeVisible()
    await page.getByLabel('Search vehicle or registration').fill('VEH055')
    await expect(rows(page)).toContainText('Sanjeewa Bandara')
    await page.getByLabel('Search vehicle or registration').fill('')
    await page.getByRole('link', { name: 'Add vehicle' }).click()
    // Only Fresh vehicles can be refrigerated.
    await page.getByRole('radio', { name: /Waypoint Style/ }).click()
    await expect(page.getByRole('radio', { name: /Refrigerated van/ })).toBeDisabled()
    await page.getByRole('radio', { name: /Waypoint Fresh/ }).click()
    await page.getByRole('radio', { name: /Refrigerated van/ }).click()
    // The capacity follows the type until it is changed.
    await expect(page.getByLabel('Weight capacity (kg)')).toHaveValue('800')
    await expect(page.getByLabel('Volume capacity (m³)')).toHaveValue('4')
    await page.getByLabel('Depot').selectOption('Kandy')
    await page.getByLabel('Weight capacity (kg)').fill('50')
    await page.getByRole('button', { name: 'Add vehicle' }).click()
    await expect(page.getByText('Between 100 and 20,000 kg.')).toBeVisible()
    await page.getByLabel('Weight capacity (kg)').fill('900')
    await page.getByLabel('Registration').fill('wp-4821')
    await page.getByRole('button', { name: 'Add vehicle' }).click()
    // The fleet already runs to VEH087, so the next id follows that, not the count.
    const heading = page.getByRole('heading', { level: 1 })
    await expect(heading).toHaveText('VEH088')
    const id = (await heading.textContent())!
    await expect(page.getByText('Refrigerated van · Kandy depot')).toBeVisible()
    await expect(page.getByText('WP-4821')).toBeVisible()
    await expect(page.getByText('No driver yet.')).toBeVisible()
    // It is in the fleet list.
    await page.goto('/administration/vehicles')
    await expect(page.getByText('Showing 1–10 of 61 vehicles')).toBeVisible()
    await page.getByLabel('Search vehicle or registration').fill('wp-4821')
    await expect(rows(page)).toHaveCount(1)
    // Add a driver from the vehicle's page: the vehicle and its depot are already chosen.
    await page.getByRole('link', { name: id, exact: true }).click()
    await page.getByRole('link', { name: 'Add driver' }).click()
    await expect(vehicleSelect(page)).toHaveValue(id)
    await expect(page.getByLabel('Depot')).toHaveValue('Kandy')
    await page.getByLabel('Full name').fill('Ruwan Jayasuriya')
    await page.getByLabel('Mobile number').fill('+94 77 555 0121')
    await page.getByLabel('Email').fill('ruwan.j@example.test')
    await page.getByRole('button', { name: 'Create user' }).click()
    await expect(page.getByRole('heading', { name: 'Ruwan’s account is ready.' })).toBeVisible()
    await page.goto(`/administration/vehicles/${id}`)
    await expect(page.getByText('Ruwan Jayasuriya').first()).toBeVisible()
    // It is no longer offered to the next driver.
    await page.goto('/administration/team/new')
    await page.getByLabel('Depot').selectOption('Kandy')
    await expect(vehicleSelect(page).locator(`option[value="${id}"]`)).toHaveCount(0)
  })

  test('long lists are shown ten at a time with previous and next', async ({ page }) => {
    await page.goto('/administration/vehicles')
    await expect(rows(page)).toHaveCount(10)
    await expect(page.getByText('Showing 1–10 of 60 vehicles')).toBeVisible()
    await expect(page.locator('.ad-table-foot').getByText('Page 1 of 6')).toBeVisible()
    const pager = page.getByRole('navigation', { name: 'Vehicles pages' }).first()
    await expect(pager.getByRole('button', { name: 'Previous' })).toBeDisabled()
    await expect(rows(page).first()).toContainText('VEH001')
    await pager.getByRole('button', { name: 'Next' }).click()
    await expect(page.getByText('Showing 11–20 of 60 vehicles')).toBeVisible()
    await expect(rows(page).first()).toContainText('VEH011')
    // A new search starts again from the first page.
    await page.getByLabel('Search vehicle or registration').fill('veh0')
    await expect(page.getByText(/Showing 1–10 of \d+ vehicles/)).toBeVisible()
    await page.getByLabel('Search vehicle or registration').fill('')
    for (let click = 0; click < 5; click += 1)
      await pager.getByRole('button', { name: 'Next' }).click()
    await expect(page.locator('.ad-table-foot').getByText('Page 6 of 6')).toBeVisible()
    await expect(pager.getByRole('button', { name: 'Next' })).toBeDisabled()
    await expect(rows(page)).toHaveCount(10)
    // A filter that leaves a few rows needs no pager.
    await page.getByRole('button', { name: 'Filter by depots' }).click()
    await page.getByRole('menuitem', { name: 'Kandy' }).click()
    await expect(page.locator('.ad-table-foot').getByText('Page 6 of 6')).toHaveCount(0)
    await expect(page.getByRole('navigation', { name: 'Vehicles pages' })).toHaveCount(0)
  })

  test('outlets and the audit log page too, and phones get the pager under the cards', async ({
    page,
  }) => {
    await page.goto('/administration/outlets')
    await expect(page.getByText('Showing 1–10 of 22 outlets')).toBeVisible()
    await page
      .getByRole('navigation', { name: 'Outlets pages' })
      .first()
      .getByRole('button', { name: 'Next' })
      .click()
    await page
      .getByRole('navigation', { name: 'Outlets pages' })
      .first()
      .getByRole('button', { name: 'Next' })
      .click()
    await expect(page.getByText('Showing 21–22 of 22 outlets')).toBeVisible()
    await expect(rows(page)).toHaveCount(2)
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/administration/vehicles')
    await expect(page.locator('.ad-cards li')).toHaveCount(10)
    const pager = page
      .locator('.ad-cards-pager')
      .getByRole('navigation', { name: 'Vehicles pages' })
    await expect(pager).toBeVisible()
    await pager.getByRole('button', { name: 'Next' }).click()
    await expect(page.locator('.ad-cards li').first()).toContainText('VEH011')
  })
})
