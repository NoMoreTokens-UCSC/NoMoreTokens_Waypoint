import { test, expect, type Page } from '@playwright/test'

const rows = (page: Page) => page.locator('.ad-table tbody tr')
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
    await page.getByLabel('Full name').fill('Dilani Rajapaksa')
    // The username follows the name until it is edited.
    await expect(page.getByLabel('Username')).toHaveValue('dilani.rajapaksa')
    await page.getByLabel('Mobile number').fill('+94 77 555 0101')
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
    await page.getByLabel('Vehicle').selectOption({ index: 1 })
    await page.getByRole('button', { name: 'Create user' }).click()
    await expect(page.getByText('That username is already taken.')).toBeVisible()
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
    await expect(page.getByText('Showing 7 of 214 events')).toBeVisible()
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
    await page.getByLabel('Vehicle').selectOption({ index: 1 })
    await page.getByRole('button', { name: 'Create user' }).click()
    await expect(page.getByRole('heading', { name: 'Chamod’s account is ready.' })).toBeVisible()
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    )
    expect(overflow).toBeLessThanOrEqual(0)
  })
})
