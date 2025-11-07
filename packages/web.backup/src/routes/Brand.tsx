import { Logo } from '@/components/Logo';
import { SecondaryButton } from '@/components/SecondaryButton';
import { useDarkMode } from '@/hooks/useDarkMode';
import { Moon, Sun } from 'lucide-react';

export default function Brand() {
  const { isDark, toggle } = useDarkMode();

  return (
    <div className="min-h-screen bg-brand-bg p-8">
      <div className="max-w-6xl mx-auto space-y-12">
        {/* Header */}
        <div className="text-center space-y-4">
          <div className="flex items-center justify-center gap-4">
            <Logo />
            <button
              onClick={toggle}
              className="p-2 rounded-lg bg-brand-surface border border-brand-border hover:bg-brand-bg-alt transition-colors"
              aria-label="Toggle dark mode"
            >
              {isDark ? (
                <Sun className="w-5 h-5 text-brand-text-primary" />
              ) : (
                <Moon className="w-5 h-5 text-brand-text-primary" />
              )}
            </button>
          </div>
          <h1 className="text-4xl font-bold text-brand-text-primary">
            Vocalytics Brand System
          </h1>
          <p className="text-brand-text-secondary">
            Design tokens, components, and visual style guide with secondary gray palette
          </p>
        </div>

        {/* Color Palette */}
        <section className="space-y-6">
          <h2 className="text-2xl font-bold text-brand-text-primary">Color Palette</h2>

          {/* Primary Colors */}
          <div>
            <h3 className="text-lg font-semibold text-brand-text-primary mb-3">Primary (CTAs & Active States)</h3>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <div className="h-24 rounded-xl bg-brand-primary"></div>
                <p className="text-sm font-mono text-brand-text-secondary">brand-primary</p>
                <p className="text-xs font-mono text-brand-text-secondary">#E63946</p>
              </div>
              <div className="space-y-2">
                <div className="h-24 rounded-xl bg-brand-primary-hover"></div>
                <p className="text-sm font-mono text-brand-text-secondary">brand-primary-hover</p>
                <p className="text-xs font-mono text-brand-text-secondary">#CC2F3A</p>
              </div>
              <div className="space-y-2">
                <div className="h-24 rounded-xl bg-brand-primary-light"></div>
                <p className="text-sm font-mono text-brand-text-secondary">brand-primary-light</p>
                <p className="text-xs font-mono text-brand-text-secondary">#FF6B6B</p>
              </div>
            </div>
          </div>

          {/* Secondary Gray Scale */}
          <div>
            <h3 className="text-lg font-semibold text-brand-text-primary mb-3">Secondary (Navigation & Chrome)</h3>
            <div className="grid grid-cols-4 gap-4">
              <div className="space-y-2">
                <div className="h-24 rounded-xl bg-brand-secondary border border-white/20"></div>
                <p className="text-sm font-mono text-brand-text-secondary">brand-secondary</p>
                <p className="text-xs font-mono text-brand-text-secondary">#374151</p>
              </div>
              <div className="space-y-2">
                <div className="h-24 rounded-xl bg-brand-secondary-light border border-white/20"></div>
                <p className="text-sm font-mono text-brand-text-secondary">brand-secondary-light</p>
                <p className="text-xs font-mono text-brand-text-secondary">#4B5563</p>
              </div>
              <div className="space-y-2">
                <div className="h-24 rounded-xl bg-brand-secondary-muted"></div>
                <p className="text-sm font-mono text-brand-text-secondary">brand-secondary-muted</p>
                <p className="text-xs font-mono text-brand-text-secondary">#6B7280</p>
              </div>
              <div className="space-y-2">
                <div className="h-24 rounded-xl bg-brand-secondary-ghost border border-brand-border"></div>
                <p className="text-sm font-mono text-brand-text-secondary">brand-secondary-ghost</p>
                <p className="text-xs font-mono text-brand-text-secondary">rgba(55,65,81,0.08)</p>
              </div>
            </div>
          </div>

          {/* Background Colors */}
          <div>
            <h3 className="text-lg font-semibold text-brand-text-primary mb-3">Background</h3>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <div className="h-24 rounded-xl bg-brand-bg border-2 border-brand-border"></div>
                <p className="text-sm font-mono text-brand-text-secondary">brand-bg</p>
                <p className="text-xs font-mono text-brand-text-secondary">#FFFFFF</p>
              </div>
              <div className="space-y-2">
                <div className="h-24 rounded-xl bg-brand-bg-alt border-2 border-brand-border"></div>
                <p className="text-sm font-mono text-brand-text-secondary">brand-bg-alt</p>
                <p className="text-xs font-mono text-brand-text-secondary">#F7F8FA</p>
              </div>
              <div className="space-y-2">
                <div className="h-24 rounded-xl bg-brand-surface border-2 border-brand-border"></div>
                <p className="text-sm font-mono text-brand-text-secondary">brand-surface</p>
                <p className="text-xs font-mono text-brand-text-secondary">#FFFFFF</p>
              </div>
            </div>
          </div>

          {/* Status Colors */}
          <div>
            <h3 className="text-lg font-semibold text-brand-text-primary mb-3">Status</h3>
            <div className="grid grid-cols-4 gap-4">
              <div className="space-y-2">
                <div className="h-24 rounded-xl bg-success"></div>
                <p className="text-sm font-mono text-brand-text-secondary">success</p>
                <p className="text-xs font-mono text-brand-text-secondary">#10B981</p>
              </div>
              <div className="space-y-2">
                <div className="h-24 rounded-xl bg-warning"></div>
                <p className="text-sm font-mono text-brand-text-secondary">warning</p>
                <p className="text-xs font-mono text-brand-text-secondary">#F59E0B</p>
              </div>
              <div className="space-y-2">
                <div className="h-24 rounded-xl bg-error"></div>
                <p className="text-sm font-mono text-brand-text-secondary">error</p>
                <p className="text-xs font-mono text-brand-text-secondary">#EF4444</p>
              </div>
              <div className="space-y-2">
                <div className="h-24 rounded-xl bg-info"></div>
                <p className="text-sm font-mono text-brand-text-secondary">info</p>
                <p className="text-xs font-mono text-brand-text-secondary">#3B82F6</p>
              </div>
            </div>
          </div>

          {/* Text Colors */}
          <div>
            <h3 className="text-lg font-semibold text-brand-text-primary mb-3">Text</h3>
            <div className="space-y-2">
              <p className="text-2xl text-brand-text-primary">Primary Text (brand-text-primary)</p>
              <p className="text-2xl text-brand-text-secondary">Secondary Text (brand-text-secondary)</p>
              <p className="text-2xl text-brand-text-accent">Accent Text (brand-text-accent)</p>
              <div className="bg-brand-primary p-4 rounded-xl">
                <p className="text-2xl text-brand-text-inverse">Inverse Text (brand-text-inverse)</p>
              </div>
            </div>
          </div>
        </section>

        {/* Gradients */}
        <section className="space-y-6">
          <h2 className="text-2xl font-bold text-brand-text-primary">Gradients</h2>
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <div className="h-24 rounded-xl bg-gradient-brand-primary"></div>
              <p className="text-sm font-mono text-brand-text-secondary">gradient-brand-primary</p>
            </div>
            <div className="space-y-2">
              <div className="h-24 rounded-xl bg-gradient-sentiment"></div>
              <p className="text-sm font-mono text-brand-text-secondary">gradient-sentiment</p>
            </div>
            <div className="space-y-2">
              <div className="h-24 rounded-xl bg-gradient-brand-bg border-2 border-brand-border"></div>
              <p className="text-sm font-mono text-brand-text-secondary">gradient-brand-bg</p>
            </div>
          </div>
        </section>

        {/* Typography */}
        <section className="space-y-6">
          <h2 className="text-2xl font-bold text-brand-text-primary">Typography</h2>
          <div className="space-y-4">
            <h1 className="text-5xl font-bold text-brand-text-primary">Heading 1</h1>
            <h2 className="text-4xl font-bold text-brand-text-primary">Heading 2</h2>
            <h3 className="text-3xl font-semibold text-brand-text-primary">Heading 3</h3>
            <h4 className="text-2xl font-semibold text-brand-text-primary">Heading 4</h4>
            <p className="text-lg text-brand-text-primary">
              Body Large - The quick brown fox jumps over the lazy dog
            </p>
            <p className="text-base text-brand-text-primary">
              Body - The quick brown fox jumps over the lazy dog
            </p>
            <p className="text-sm text-brand-text-secondary">
              Small - The quick brown fox jumps over the lazy dog
            </p>
            <p className="text-xs text-brand-text-secondary">
              Extra Small - The quick brown fox jumps over the lazy dog
            </p>
          </div>
        </section>

        {/* Components */}
        <section className="space-y-6">
          <h2 className="text-2xl font-bold text-brand-text-primary">Components</h2>

          {/* Navigation Preview */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-brand-text-primary">Navigation Chrome</h3>
            <div className="bg-brand-secondary rounded-xl overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3">
                <Logo />
                <div className="flex items-center gap-2">
                  <button className="text-white/90 hover:text-white hover:bg-brand-secondary-ghost px-3 py-2 rounded-lg transition-colors text-sm">
                    Dashboard
                  </button>
                  <button className="text-white/90 hover:text-white hover:bg-brand-secondary-ghost px-3 py-2 rounded-lg transition-colors text-sm">
                    Videos
                  </button>
                  <button className="text-white/90 hover:text-white hover:bg-brand-secondary-ghost px-3 py-2 rounded-lg transition-colors text-sm">
                    Settings
                  </button>
                </div>
              </div>
            </div>
            <div className="flex gap-4">
              <div className="bg-brand-secondary-light rounded-xl p-4 flex-1">
                <p className="text-white text-sm font-medium mb-2">Sidebar Item</p>
                <div className="space-y-1">
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-brand-secondary-ghost text-white text-sm relative after:absolute after:left-0 after:top-0 after:bottom-0 after:w-1 after:bg-brand-primary after:rounded-r">
                    Active
                  </div>
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-white/80 hover:bg-brand-secondary-ghost hover:text-white text-sm transition-colors">
                    Inactive
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Buttons */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-brand-text-primary">Buttons</h3>
            <div className="flex flex-wrap gap-4 items-center">
              <button className="px-6 py-2 bg-brand-primary text-brand-text-inverse rounded-xl font-medium hover:bg-brand-primary-hover transition-colors">
                Primary Button
              </button>
              <SecondaryButton label="Secondary Button" />
              <button className="px-6 py-2 bg-transparent text-brand-primary border-2 border-brand-primary rounded-xl font-medium hover:bg-brand-primary hover:text-brand-text-inverse transition-colors">
                Outline Button
              </button>
              <button className="px-6 py-2 bg-brand-primary text-brand-text-inverse rounded-xl font-medium opacity-60 cursor-not-allowed" disabled>
                Disabled
              </button>
            </div>
            <p className="text-sm text-brand-secondary-muted">
              Use <span className="font-mono bg-brand-bg-alt px-1 rounded">brand-primary</span> for CTAs and key actions.
              Use <span className="font-mono bg-brand-bg-alt px-1 rounded">brand-secondary-light</span> for neutral actions.
            </p>
          </div>

          {/* Cards */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-brand-text-primary">Cards</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-brand-surface border border-brand-border rounded-xl p-6 shadow-brand-card space-y-2">
                <h4 className="text-xl font-semibold text-brand-text-primary">Card Title</h4>
                <p className="text-brand-text-secondary">
                  This is a standard card component with brand styling.
                </p>
              </div>
              <div className="bg-gradient-brand-primary rounded-xl p-6 space-y-2">
                <h4 className="text-xl font-semibold text-brand-text-inverse">Gradient Card</h4>
                <p className="text-brand-text-inverse opacity-90">
                  This card uses the primary gradient background.
                </p>
              </div>
            </div>
          </div>

          {/* Inputs */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-brand-text-primary">Form Inputs</h3>
            <div className="grid grid-cols-2 gap-4">
              <input
                type="text"
                placeholder="Default input"
                className="px-4 py-2 bg-brand-surface border border-brand-border rounded-xl text-brand-text-primary placeholder:text-brand-text-secondary focus:outline-none focus:ring-2 focus:ring-brand-primary"
              />
              <input
                type="text"
                placeholder="Focused input"
                className="px-4 py-2 bg-brand-surface border border-brand-border rounded-xl text-brand-text-primary placeholder:text-brand-text-secondary outline-none ring-2 ring-brand-primary"
              />
            </div>
          </div>

          {/* Tables & Charts */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-brand-text-primary">Tables & Charts</h3>
            <div className="bg-brand-surface border border-brand-border rounded-xl p-4">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-brand-border">
                    <th className="text-left py-2 px-4 text-sm font-semibold text-brand-secondary-muted">Metric</th>
                    <th className="text-right py-2 px-4 text-sm font-semibold text-brand-secondary-muted">Value</th>
                    <th className="text-right py-2 px-4 text-sm font-semibold text-brand-secondary-muted">Change</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-brand-border/50">
                    <td className="py-2 px-4 text-sm text-brand-text-primary">Comments Analyzed</td>
                    <td className="text-right py-2 px-4 text-sm text-brand-text-primary font-medium">1,234</td>
                    <td className="text-right py-2 px-4 text-sm text-success">+12%</td>
                  </tr>
                  <tr className="border-b border-brand-border/50">
                    <td className="py-2 px-4 text-sm text-brand-text-primary">Sentiment Score</td>
                    <td className="text-right py-2 px-4 text-sm text-brand-text-primary font-medium">7.8/10</td>
                    <td className="text-right py-2 px-4 text-sm text-warning">-2%</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-4 text-sm text-brand-text-primary">Active Users</td>
                    <td className="text-right py-2 px-4 text-sm text-brand-text-primary font-medium">567</td>
                    <td className="text-right py-2 px-4 text-sm text-success">+8%</td>
                  </tr>
                </tbody>
              </table>
              <p className="text-xs text-brand-secondary-muted mt-4">
                Use <span className="font-mono bg-brand-bg-alt px-1 rounded">brand-secondary-muted</span> for table headers and chart axis labels
              </p>
            </div>
          </div>
        </section>

        {/* Spacing */}
        <section className="space-y-6">
          <h2 className="text-2xl font-bold text-brand-text-primary">Spacing & Borders</h2>
          <div className="space-y-4">
            <div className="space-y-2">
              <p className="text-sm font-semibold text-brand-text-primary">Border Radius</p>
              <div className="flex gap-4">
                <div className="w-24 h-24 bg-brand-primary rounded-sm flex items-center justify-center">
                  <span className="text-xs text-brand-text-inverse">sm</span>
                </div>
                <div className="w-24 h-24 bg-brand-primary rounded-md flex items-center justify-center">
                  <span className="text-xs text-brand-text-inverse">md</span>
                </div>
                <div className="w-24 h-24 bg-brand-primary rounded-lg flex items-center justify-center">
                  <span className="text-xs text-brand-text-inverse">lg</span>
                </div>
                <div className="w-24 h-24 bg-brand-primary rounded-xl flex items-center justify-center">
                  <span className="text-xs text-brand-text-inverse">xl</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Usage Example */}
        <section className="space-y-6">
          <h2 className="text-2xl font-bold text-brand-text-primary">Usage Example</h2>
          <div className="bg-brand-surface border border-brand-border rounded-xl p-8 shadow-brand-card space-y-6">
            <div className="flex items-center justify-between">
              <Logo />
              <button className="px-4 py-2 bg-brand-primary text-brand-text-inverse rounded-xl font-medium hover:bg-brand-primary-hover transition-colors">
                Sign In
              </button>
            </div>
            <div className="space-y-4">
              <h3 className="text-2xl font-bold text-brand-text-primary">
                Welcome to Vocalytics
              </h3>
              <p className="text-brand-text-secondary">
                AI-powered YouTube comment analysis and sentiment tracking for content creators.
              </p>
              <div className="flex gap-4">
                <button className="px-6 py-3 bg-brand-primary text-brand-text-inverse rounded-xl font-medium hover:bg-brand-primary-hover transition-colors">
                  Get Started
                </button>
                <button className="px-6 py-3 bg-transparent text-brand-primary border-2 border-brand-primary rounded-xl font-medium hover:bg-brand-primary hover:text-brand-text-inverse transition-colors">
                  Learn More
                </button>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
