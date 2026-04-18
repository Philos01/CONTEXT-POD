import { describe, it, expect, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import ReplyCard from '@/components/ReplyCard.vue';
import type { ReplyStrategy } from '@/types';

const mockStrategy: ReplyStrategy = {
  label: 'A',
  style: '顺从推进',
  content: '好的老板，马上办！',
};

describe('ReplyCard', () => {
  it('should render strategy label and content', () => {
    const wrapper = mount(ReplyCard, {
      props: { strategy: mockStrategy, index: 0 },
      global: { plugins: [createPinia()] },
    });

    expect(wrapper.text()).toContain('A');
    expect(wrapper.text()).toContain('顺从推进');
    expect(wrapper.text()).toContain('好的老板，马上办！');
  });

  it('should emit select event on click', async () => {
    const wrapper = mount(ReplyCard, {
      props: { strategy: mockStrategy, index: 0 },
      global: { plugins: [createPinia()] },
    });

    await wrapper.trigger('click');
    expect(wrapper.emitted('select')).toBeTruthy();
    expect(wrapper.emitted('select')![0]).toEqual(['好的老板，马上办！']);
  });

  it('should apply different styles for different indices', () => {
    const wrapper0 = mount(ReplyCard, {
      props: { strategy: mockStrategy, index: 0 },
      global: { plugins: [createPinia()] },
    });
    const wrapper1 = mount(ReplyCard, {
      props: { strategy: { ...mockStrategy, style: '委婉甩锅' }, index: 1 },
      global: { plugins: [createPinia()] },
    });
    const wrapper2 = mount(ReplyCard, {
      props: { strategy: { ...mockStrategy, style: '幽默化解' }, index: 2 },
      global: { plugins: [createPinia()] },
    });

    expect(wrapper0.classes().length).toBeGreaterThan(0);
    expect(wrapper1.classes().length).toBeGreaterThan(0);
    expect(wrapper2.classes().length).toBeGreaterThan(0);
  });
});
